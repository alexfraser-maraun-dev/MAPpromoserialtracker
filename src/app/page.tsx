'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Plus, Play, Download, Archive, BarChart3, X, Settings2, Trash2, Copy } from 'lucide-react';
import { useSession } from 'next-auth/react';

type Collection = {
  id: string;
  name: string;
  brand: string | null;
  status: 'draft' | 'active' | 'closed' | 'exported';
  restricted_skus: string | null;
  restricted_brands: string | null;
  created_at: string;
};

export default function Home() {
  const { data: session } = useSession();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionBrand, setNewCollectionBrand] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [activeRollupId, setActiveRollupId] = useState<string | null>(null);
  const [rollupData, setRollupData] = useState<Record<string, any>>({});
  const [isRollupLoading, setIsRollupLoading] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newBrand, setNewBrand] = useState('');

  const filteredCollections = showClosed 
    ? collections 
    : collections.filter(c => c.status !== 'closed');

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCollections(data);
    }
    setIsLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName || !session?.user?.email) return;

    setIsCreating(true);
    const { data, error } = await supabase
      .from('collections')
      .insert([
        {
          name: newCollectionName,
          brand: newCollectionBrand || null,
          status: 'active',
          created_by: session.user.email,
        }
      ])
      .select()
      .single();

    if (!error && data) {
      setCollections([data, ...collections]);
      setNewCollectionName('');
      setNewCollectionBrand('');
    }
    setIsCreating(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('collections').update({ status }).eq('id', id);
    fetchCollections();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection) return;

    setIsSavingSettings(true);
    const { error } = await supabase
      .from('collections')
      .update({
        name: editingCollection.name,
        brand: editingCollection.brand,
        restricted_skus: editingCollection.restricted_skus,
        restricted_brands: editingCollection.restricted_brands
      })
      .eq('id', editingCollection.id);

    if (!error) {
      fetchCollections();
      setEditingCollection(null);
    }
    setIsSavingSettings(false);
  };

  const handleDuplicate = async (col: Collection) => {
    if (!session?.user?.email) return;

    const { data, error } = await supabase
      .from('collections')
      .insert([
        {
          name: `${col.name} (Copy)`,
          brand: col.brand,
          status: 'active',
          restricted_skus: col.restricted_skus,
          restricted_brands: col.restricted_brands,
          created_by: session.user.email,
        }
      ])
      .select()
      .single();

    if (!error && data) {
      setCollections([data, ...collections]);
    } else {
      alert('Failed to duplicate collection.');
    }
  };

  const downloadCsv = (id: string) => {
    window.open(`/api/collections/export/${id}`, '_blank');
  };

  const fetchRollup = async (col: Collection) => {
    if (activeRollupId === col.id) {
      setActiveRollupId(null);
      return;
    }

    if (rollupData[col.id]) {
      setActiveRollupId(col.id);
      return;
    }

    setIsRollupLoading(true);
    const { data, error } = await supabase
      .from('serial_scans')
      .select('product_description, brand, scanned_by')
      .eq('collection_id', col.id);

    if (!error && data) {
      const byProduct: Record<string, number> = {};
      const byEmployee: Record<string, number> = {};
      const byBrand: Record<string, number> = {};

      data.forEach(scan => {
        const prod = scan.product_description || 'Unmatched';
        const emp = scan.scanned_by || 'Unknown';
        const brand = scan.brand || 'Unknown';

        byProduct[prod] = (byProduct[prod] || 0) + 1;
        byEmployee[emp] = (byEmployee[emp] || 0) + 1;
        byBrand[brand] = (byBrand[brand] || 0) + 1;
      });

      setRollupData(prev => ({
        ...prev,
        [col.id]: { byProduct, byEmployee, byBrand }
      }));
      setActiveRollupId(col.id);
    }
    setIsRollupLoading(false);
  };

  const closeRollup = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setActiveRollupId(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Serial Number Collections</h1>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input 
            type="checkbox" 
            checked={showClosed} 
            onChange={(e) => setShowClosed(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Show Closed
        </label>
      </div>

      <div className="card mb-4 p-4 py-3 bg-primary bg-opacity-5 border-primary border-opacity-10">
        <h4 className="text-primary mb-2 text-[10px] uppercase tracking-widest font-bold">Quick Guide</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[12px]">
          <div>
            <span className="font-bold mr-1">1. Create:</span>
            <span className="text-muted">Start a collection with a descriptive name.</span>
          </div>
          <div>
            <span className="font-bold mr-1">2. Scan:</span>
            <span className="text-muted">Use <strong>Start Scanning</strong> to record serials.</span>
          </div>
          <div>
            <span className="font-bold mr-1">3. Finalize:</span>
            <span className="text-muted"><strong>Export</strong> CSV or <strong>Archive</strong> when finished.</span>
          </div>
        </div>
      </div>

      <div className="card mb-6 p-4">
        <h3 className="text-base mb-3">Create New Collection</h3>
        <form onSubmit={handleCreate} className="flex gap-4 items-center">
          <div style={{ flex: 1 }}>
            <input 
              type="text" 
              placeholder="Name (e.g., Summer MAP Window)" 
              className="input py-2 text-sm"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <input 
              type="text" 
              placeholder="Brand (Optional)" 
              className="input py-2 text-sm"
              value={newCollectionBrand}
              onChange={(e) => setNewCollectionBrand(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary py-2" disabled={isCreating}>
            <Plus size={16} className="mr-1" /> Create
          </button>
        </form>
      </div>

      {isLoading ? (
        <p>Loading collections...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
          {filteredCollections.map(col => (
            <div key={col.id} className="card flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 style={{ margin: 0 }}>{col.name}</h3>
                  <span className={`badge badge-${col.status === 'active' ? 'success' : col.status === 'draft' ? 'warning' : 'neutral'}`}>
                    {col.status}
                  </span>
                </div>
                <p className="text-sm text-muted mb-4">
                  {col.brand ? `Brand: ${col.brand}` : 'No brand specified'} <br />
                  Created: {new Date(col.created_at).toLocaleDateString()}
                </p>
              </div>
              
              <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
                <Link href={`/collection/${col.id}`} className="btn btn-outline" style={{ flex: 1 }}>
                  View Scans
                </Link>

                {col.status === 'active' && (
                  <Link href={`/scan/${col.id}`} className="btn btn-primary" style={{ flex: 1 }}>
                    <Play size={16} className="mr-2" /> Start Scanning
                  </Link>
                )}
                
                {col.status === 'active' && (
                  <button onClick={() => updateStatus(col.id, 'closed')} className="btn btn-outline" title="Close Collection">
                    <Archive size={16} />
                  </button>
                )}

                {(col.status === 'closed' || col.status === 'exported') && (
                  <button onClick={() => updateStatus(col.id, 'active')} className="btn btn-outline text-warning" title="Reopen Collection">
                    Reopen
                  </button>
                )}

                {(col.status === 'closed' || col.status === 'active' || col.status === 'exported') && (
                  <button onClick={() => downloadCsv(col.id)} className="btn btn-outline" title="Export CSV">
                    <Download size={16} /> Export
                  </button>
                )}

                <button 
                  onClick={() => {
                    setActiveRollupId(null);
                    setEditingCollection(col);
                  }} 
                  className="btn btn-outline" 
                  title="Settings"
                >
                  <Settings2 size={16} />
                </button>

                <button onClick={() => handleDuplicate(col)} className="btn btn-outline" title="Duplicate Collection">
                  <Copy size={16} />
                </button>

                <button 
                  onClick={() => fetchRollup(col)} 
                  className={`btn ${activeRollupId === col.id ? 'btn-primary' : 'btn-outline'}`}
                  title="Rollup Summary"
                  disabled={isRollupLoading && activeRollupId !== col.id}
                >
                  <BarChart3 size={16} className="mr-2" /> Rollup
                </button>
              </div>

              {/* Inline Rollup Section */}
              <div 
                className={`overflow-hidden transition-all duration-500 ease-in-out ${activeRollupId === col.id ? 'max-h-[2000px] mt-6 opacity-100' : 'max-h-0 opacity-0 invisible'}`}
              >
                {rollupData[col.id] && (
                  <div className="bg-muted bg-opacity-30 rounded-xl p-5 border border-border flex flex-col gap-6 relative">
                    <button 
                      onClick={closeRollup} 
                      className="btn-close absolute top-4 right-4 z-10"
                      title="Close Summary"
                    >
                      <X size={16} />
                    </button>

                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 size={14} className="text-primary" />
                      <h4 className="uppercase tracking-widest text-[10px] font-bold text-muted m-0">Collection Summary</h4>
                    </div>

                    <div className="flex flex-col gap-6">
                      <section>
                        <h5 className="text-xs font-semibold mb-3 flex justify-between items-center">
                          <span>By Product</span>
                          <span className="text-[10px] text-muted font-normal">Count</span>
                        </h5>
                        <div className="flex flex-col gap-3">
                          {Object.entries(rollupData[col.id].byProduct)
                            .sort((a: any, b: any) => b[1] - a[1])
                            .map(([name, count]: any) => {
                              const counts = Object.values(rollupData[col.id].byProduct) as number[];
                              const max = Math.max(...counts);
                              const percent = (count / max) * 100;
                              return (
                                <div key={name} className="flex flex-col gap-1.5">
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="font-medium truncate pr-4" title={name}>{name}</span>
                                    <span className="font-bold">{count}</span>
                                  </div>
                                  <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden border border-border border-opacity-30">
                                    <div 
                                      className="bg-primary h-full rounded-full transition-all duration-1000" 
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </section>

                      <div className="grid grid-cols-1 gap-6">
                        <section>
                          <h5 className="text-xs font-semibold mb-3 flex justify-between items-center">
                            <span>By Employee</span>
                          </h5>
                          <div className="grid grid-cols-1 gap-2">
                            {Object.entries(rollupData[col.id].byEmployee)
                              .sort((a: any, b: any) => b[1] - a[1])
                              .map(([name, count]: any) => (
                                <div key={name} className="flex justify-between items-center text-[11px] bg-surface p-2 rounded-lg border border-border border-opacity-50">
                                  <span className="truncate text-muted">{name}</span>
                                  <span className="badge badge-neutral shrink-0" style={{ fontSize: '10px' }}>{count}</span>
                                </div>
                              ))}
                          </div>
                        </section>

                        <section>
                          <h5 className="text-xs font-semibold mb-3 flex justify-between items-center">
                            <span>By Brand</span>
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(rollupData[col.id].byBrand)
                              .sort((a: any, b: any) => b[1] - a[1])
                              .map(([name, count]: any) => (
                                <div key={name} className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-full border border-border border-opacity-50 text-[11px]">
                                  <span className="font-medium">{name}</span>
                                  <div className="w-px h-3 bg-border" />
                                  <span className="font-bold text-primary">{count}</span>
                                </div>
                              ))}
                          </div>
                        </section>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {collections.length === 0 && (
            <p className="text-muted col-span-full">No collections found. Create one to get started.</p>
          )}
        </div>
      )}

      {/* Settings Modal */}
      {editingCollection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setEditingCollection(null)}
              className="btn-close absolute top-4 right-4"
              title="Close Settings"
            >
              <X size={16} />
            </button>
            
            <h2 className="mb-6 flex items-center gap-2">
              <Settings2 className="text-primary" /> Collection Settings
            </h2>
            
            <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-muted mb-1 block">Collection Name</label>
                <input 
                  type="text" 
                  className="input w-full"
                  value={editingCollection.name}
                  onChange={e => setEditingCollection({...editingCollection, name: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-muted mb-1 block">Default Brand</label>
                <input 
                  type="text" 
                  className="input w-full"
                  value={editingCollection.brand || ''}
                  onChange={e => setEditingCollection({...editingCollection, brand: e.target.value || null})}
                />
              </div>

              <div className="p-4 bg-primary bg-opacity-5 rounded-lg border border-primary border-opacity-10 mt-2">
                <h4 className="text-xs font-bold uppercase text-primary mb-4">Scanning Restrictions</h4>
                
                <div className="flex flex-col gap-6">
                  {/* SKU/UPC Restrictions Table */}
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted mb-2 block">Allowed System SKUs or UPCs</label>
                    <div className="flex gap-2 mb-2">
                      <input 
                        type="text" 
                        className="input text-xs font-mono py-1 flex-1" 
                        placeholder="Enter SKU or UPC..." 
                        value={newSku}
                        onChange={e => setNewSku(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const val = newSku.trim(); if (val) { const current = editingCollection.restricted_skus ? editingCollection.restricted_skus.split(',') : []; if (!current.includes(val)) { setEditingCollection({...editingCollection, restricted_skus: [...current, val].join(',')}); } setNewSku(''); } } }}
                      />
                      <button 
                        type="button" 
                        onClick={() => { const val = newSku.trim(); if (val) { const current = editingCollection.restricted_skus ? editingCollection.restricted_skus.split(',') : []; if (!current.includes(val)) { setEditingCollection({...editingCollection, restricted_skus: [...current, val].join(',')}); } setNewSku(''); } }}
                        className="btn btn-primary btn-sm px-2"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="max-h-32 overflow-y-auto border border-border rounded-lg bg-surface">
                      <table className="w-full text-[11px]">
                        <tbody className="divide-y divide-border">
                          {(editingCollection.restricted_skus ? editingCollection.restricted_skus.split(',') : []).map((sku, idx) => (
                            <tr key={idx} className="hover:bg-muted group">
                              <td className="px-3 py-2 font-mono">{sku}</td>
                              <td className="px-3 py-2 text-right">
                                <button 
                                  type="button" 
                                  onClick={() => { const current = editingCollection.restricted_skus?.split(',') || []; const updated = current.filter((_, i) => i !== idx).join(','); setEditingCollection({...editingCollection, restricted_skus: updated || null}); }}
                                  className="text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {!(editingCollection.restricted_skus) && (
                            <tr><td className="px-3 py-2 text-muted italic">No SKU restrictions set.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Brand Restrictions Table */}
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted mb-2 block">Allowed Brands</label>
                    <div className="flex gap-2 mb-2">
                      <input 
                        type="text" 
                        className="input text-xs py-1 flex-1" 
                        placeholder="Enter Brand..." 
                        value={newBrand}
                        onChange={e => setNewBrand(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const val = newBrand.trim(); if (val) { const current = editingCollection.restricted_brands ? editingCollection.restricted_brands.split(',') : []; if (!current.includes(val)) { setEditingCollection({...editingCollection, restricted_brands: [...current, val].join(',')}); } setNewBrand(''); } } }}
                      />
                      <button 
                        type="button" 
                        onClick={() => { const val = newBrand.trim(); if (val) { const current = editingCollection.restricted_brands ? editingCollection.restricted_brands.split(',') : []; if (!current.includes(val)) { setEditingCollection({...editingCollection, restricted_brands: [...current, val].join(',')}); } setNewBrand(''); } }}
                        className="btn btn-primary btn-sm px-2"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="max-h-32 overflow-y-auto border border-border rounded-lg bg-surface">
                      <table className="w-full text-[11px]">
                        <tbody className="divide-y divide-border">
                          {(editingCollection.restricted_brands ? editingCollection.restricted_brands.split(',') : []).map((brand, idx) => (
                            <tr key={idx} className="hover:bg-muted group">
                              <td className="px-3 py-2">{brand}</td>
                              <td className="px-3 py-2 text-right">
                                <button 
                                  type="button" 
                                  onClick={() => { const current = editingCollection.restricted_brands?.split(',') || []; const updated = current.filter((_, i) => i !== idx).join(','); setEditingCollection({...editingCollection, restricted_brands: updated || null}); }}
                                  className="text-error opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {!(editingCollection.restricted_brands) && (
                            <tr><td className="px-3 py-2 text-muted italic">No brand restrictions set.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setEditingCollection(null)} 
                  className="btn btn-outline flex-1"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1"
                  disabled={isSavingSettings}
                >
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

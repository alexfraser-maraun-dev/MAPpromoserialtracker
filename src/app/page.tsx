'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Plus, Play, Download, Archive, BarChart3, X } from 'lucide-react';
import { useSession } from 'next-auth/react';

type Collection = {
  id: string;
  name: string;
  brand: string | null;
  status: 'draft' | 'active' | 'closed' | 'exported';
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
  const [activeRollup, setActiveRollup] = useState<{
    collection: Collection;
    stats: {
      byProduct: Record<string, number>;
      byEmployee: Record<string, number>;
      byBrand: Record<string, number>;
    }
  } | null>(null);
  const [isRollupLoading, setIsRollupLoading] = useState(false);

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

  const downloadCsv = (id: string) => {
    window.open(`/api/collections/export/${id}`, '_blank');
  };

  const fetchRollup = async (col: Collection) => {
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

      setActiveRollup({
        collection: col,
        stats: { byProduct, byEmployee, byBrand }
      });
    }
    setIsRollupLoading(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Collections</h1>
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

      <div className="card mb-6">
        <h3>Create New Collection</h3>
        <form onSubmit={handleCreate} className="flex gap-4 mt-4 items-center">
          <div style={{ flex: 1 }}>
            <input 
              type="text" 
              placeholder="Collection Name (e.g., Summer MAP Window)" 
              className="input"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <input 
              type="text" 
              placeholder="Brand (Optional)" 
              className="input"
              value={newCollectionBrand}
              onChange={(e) => setNewCollectionBrand(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isCreating}>
            <Plus size={18} className="mr-2" /> Create
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
                  onClick={() => fetchRollup(col)} 
                  className="btn btn-outline" 
                  title="Rollup Summary"
                  disabled={isRollupLoading}
                >
                  <BarChart3 size={16} className="mr-2" /> Rollup
                </button>
              </div>
            </div>
          ))}
          {collections.length === 0 && (
            <p className="text-muted col-span-full">No collections found. Create one to get started.</p>
          )}
        </div>
      )}
      {/* Rollup Modal */}
      {activeRollup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-2xl bg-surface max-h-[90vh] overflow-y-auto relative shadow-2xl">
            <button 
              onClick={() => setActiveRollup(null)}
              className="absolute top-4 right-4 text-muted hover:text-text p-2"
            >
              <X size={24} />
            </button>

            <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <BarChart3 className="text-primary" size={28} />
              <div>
                <h2 style={{ margin: 0 }}>Collection Rollup</h2>
                <p className="text-muted">{activeRollup.collection.name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="mb-4 text-primary uppercase tracking-wider text-xs">By Product</h4>
                <div className="flex flex-col gap-2">
                  {Object.entries(activeRollup.stats.byProduct)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => (
                      <div key={name} className="flex justify-between items-center text-sm border-b border-border border-opacity-50 pb-1">
                        <span className="truncate mr-4" title={name}>{name}</span>
                        <strong className="shrink-0">{count}</strong>
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex flex-col gap-8">
                <div>
                  <h4 className="mb-4 text-primary uppercase tracking-wider text-xs">By Employee</h4>
                  <div className="flex flex-col gap-2">
                    {Object.entries(activeRollup.stats.byEmployee)
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, count]) => (
                        <div key={name} className="flex justify-between items-center text-sm border-b border-border border-opacity-50 pb-1">
                          <span className="truncate mr-4">{name}</span>
                          <strong className="shrink-0">{count}</strong>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-4 text-primary uppercase tracking-wider text-xs">By Brand</h4>
                  <div className="flex flex-col gap-2">
                    {Object.entries(activeRollup.stats.byBrand)
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, count]) => (
                        <div key={name} className="flex justify-between items-center text-sm border-b border-border border-opacity-50 pb-1">
                          <span className="truncate mr-4">{name}</span>
                          <strong className="shrink-0">{count}</strong>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-4 text-primary uppercase tracking-wider text-xs">Collection Info</h4>
                  <div className="text-sm flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span className="text-muted">Created</span>
                      <span>{new Date(activeRollup.collection.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Status</span>
                      <span className="capitalize">{activeRollup.collection.status}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t flex justify-end">
              <button onClick={() => setActiveRollup(null)} className="btn btn-primary">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

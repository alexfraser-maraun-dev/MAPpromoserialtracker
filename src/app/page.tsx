'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Plus, Play, Download, Archive } from 'lucide-react';
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
              </div>
            </div>
          ))}
          {collections.length === 0 && (
            <p className="text-muted col-span-full">No collections found. Create one to get started.</p>
          )}
        </div>
      )}
    </div>
  );
}

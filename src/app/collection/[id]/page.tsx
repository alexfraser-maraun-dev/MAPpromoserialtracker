'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';

type Scan = {
  id: string;
  serial_number: string;
  normalized_serial_number: string;
  match_status: string;
  product_description: string;
  brand: string;
  qty_sold: number;
  scanned_at: string;
  scanned_by: string;
};

export default function CollectionViewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const collectionId = resolvedParams.id;
  const { data: session } = useSession();
  
  const [scans, setScans] = useState<Scan[]>([]);
  const [collection, setCollection] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [collectionId]);

  const fetchData = async () => {
    const { data: colData } = await supabase.from('collections').select('*').eq('id', collectionId).single();
    if (colData) setCollection(colData);

    const { data: scanData } = await supabase
      .from('serial_scans')
      .select('*')
      .eq('collection_id', collectionId)
      .order('scanned_at', { ascending: false });
    
    if (scanData) setScans(scanData);
  };

  const handleDelete = async (scanId: string) => {
    if (!confirm('Are you sure you want to delete this scan? This action cannot be undone.')) return;

    const { error } = await supabase
      .from('serial_scans')
      .delete()
      .eq('id', scanId);

    if (!error) {
      setScans(prev => prev.filter(s => s.id !== scanId));
    } else {
      alert('Failed to delete scan.');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="btn btn-outline" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ margin: 0 }}>{collection?.name || 'Loading Collection...'}</h1>
          <p className="text-muted">Total Scans: {scans.length}</p>
        </div>
      </div>

      <div className="card">
        {scans.length === 0 ? (
          <p className="text-muted text-center py-8">No scans found in this collection.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="pb-2">Serial Number</th>
                  <th className="pb-2">Product Description</th>
                  <th className="pb-2">Brand</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Scanned By</th>
                  <th className="pb-2">Scanned At</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scans.map(scan => (
                  <tr key={scan.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 font-mono">{scan.serial_number}</td>
                    <td className="py-3">{scan.product_description || '-'}</td>
                    <td className="py-3">{scan.brand || '-'}</td>
                    <td className="py-3">
                      <span className={`badge badge-${scan.match_status === 'matched' || scan.match_status === 'manually_assigned' ? 'success' : 'warning'}`}>
                        {scan.match_status}
                      </span>
                    </td>
                    <td className="py-3 text-sm">{scan.scanned_by}</td>
                    <td className="py-3 text-sm text-muted">{new Date(scan.scanned_at).toLocaleString()}</td>
                    <td className="py-3 text-right">
                      <button 
                        onClick={() => handleDelete(scan.id)} 
                        className="text-error hover:text-red-700 transition-colors p-2"
                        title="Delete Scan"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

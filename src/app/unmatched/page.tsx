'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from 'next-auth/react';
import { Edit2, CheckCircle2 } from 'lucide-react';

type Scan = {
  id: string;
  serial_number: string;
  normalized_serial_number: string;
  scanned_at: string;
  collection_id: string;
};

export default function UnmatchedPage() {
  const { data: session } = useSession();
  const [unmatched, setUnmatched] = useState<Scan[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Edit form state
  const [brand, setBrand] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [upc, setUpc] = useState('');
  const [systemSku, setSystemSku] = useState('');
  const [manufacturerSku, setManufacturerSku] = useState('');

  useEffect(() => {
    fetchUnmatched();
  }, []);

  const fetchUnmatched = async () => {
    const { data } = await supabase
      .from('serial_scans')
      .select('id, serial_number, normalized_serial_number, scanned_at, collection_id')
      .eq('match_status', 'unmatched')
      .order('scanned_at', { ascending: false });
    
    if (data) setUnmatched(data);
  };

  const [isSearching, setIsSearching] = useState(false);

  const startEditing = (scan: Scan) => {
    setEditingId(scan.id);
    setBrand('');
    setVendorId('');
    setProductDescription('');
    setUpc('');
    setSystemSku('');
    setManufacturerSku('');
  };

  const handleUpcSearch = async () => {
    if (!upc) return;
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/bigquery/lookup?upc=${encodeURIComponent(upc)}`);
      const data = await res.json();
      
      if (res.ok) {
        if (data.found) {
          setBrand(data.product.brand || '');
          setVendorId(data.product.vendor_id || '');
          setProductDescription(data.product.product_description || '');
          setSystemSku(data.product.system_sku || '');
          setManufacturerSku(data.product.manufacturer_sku || '');
        } else {
          alert('Product not found in BigQuery. Please enter details manually.');
        }
      } else {
        alert(`BigQuery Error: ${data.details || data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error(err);
      alert('Error searching BigQuery. Check the console.');
    }
    setIsSearching(false);
  };

  const handleSave = async (id: string) => {
    if (!productDescription) {
      alert('Product Description is required.');
      return;
    }

    const { error } = await supabase
      .from('serial_scans')
      .update({
        brand,
        vendor_id: vendorId,
        product_description: productDescription,
        upc,
        system_sku: systemSku,
        manufacturer_sku: manufacturerSku,
        match_status: 'manually_assigned'
      })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      fetchUnmatched();
    } else {
      alert('Failed to save manually assigned data.');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Unmatched Scans</h1>
      </div>

      <div className="card">
        {unmatched.length === 0 ? (
          <p className="text-muted text-center py-8">No unmatched scans found. Great job!</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th className="pb-2">Serial Number</th>
                <th className="pb-2">Scanned At</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {unmatched.map(scan => (
                <React.Fragment key={scan.id}>
                  <tr style={{ borderBottom: editingId === scan.id ? 'none' : '1px solid var(--border)' }}>
                    <td className="py-3 font-mono">{scan.serial_number}</td>
                    <td className="py-3 text-muted">{new Date(scan.scanned_at).toLocaleString()}</td>
                    <td className="py-3 text-right">
                      {editingId === scan.id ? (
                        <button onClick={() => setEditingId(null)} className="btn btn-outline text-sm">Cancel</button>
                      ) : (
                        <button onClick={() => startEditing(scan)} className="btn btn-outline text-sm">
                          <Edit2 size={16} className="mr-2" /> Assign Product
                        </button>
                      )}
                    </td>
                  </tr>
                  {editingId === scan.id && (
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={3} className="py-4">
                        <div className="card" style={{ backgroundColor: 'var(--background)' }}>
                          <h4 className="mb-4">Assign Product Data</h4>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <input className="input" placeholder="Product Description *" value={productDescription} onChange={e => setProductDescription(e.target.value)} required />
                            <input className="input" placeholder="Brand" value={brand} onChange={e => setBrand(e.target.value)} />
                            <input className="input" placeholder="Vendor ID" value={vendorId} onChange={e => setVendorId(e.target.value)} />
                            <div className="flex gap-2">
                              <input className="input flex-1" placeholder="UPC" value={upc} onChange={e => setUpc(e.target.value)} />
                              <button type="button" onClick={handleUpcSearch} disabled={isSearching || !upc} className="btn btn-outline">
                                {isSearching ? '...' : 'Lookup'}
                              </button>
                            </div>
                            <input className="input" placeholder="System SKU" value={systemSku} onChange={e => setSystemSku(e.target.value)} />
                            <input className="input" placeholder="Manufacturer SKU" value={manufacturerSku} onChange={e => setManufacturerSku(e.target.value)} />
                          </div>
                          <button onClick={() => handleSave(scan.id)} className="btn btn-primary">
                            <CheckCircle2 size={18} className="mr-2" /> Save Assignment
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

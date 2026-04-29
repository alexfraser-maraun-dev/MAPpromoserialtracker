'use client';

import { useEffect, useState, useRef, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from 'next-auth/react';
import { CheckCircle2, AlertCircle, Clock, XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type ScanRow = {
  id: string; // Temporary UUID for UI
  serial_number: string;
  normalized_serial_number: string;
  status: 'pending' | 'saved' | 'matched' | 'unmatched' | 'duplicate' | 'error';
  product_description?: string;
  timestamp: Date;
};

type MappingRule = {
  id: string;
  match_type: 'prefix' | 'contains' | 'regex' | 'exact';
  match_value: string;
  priority: number;
  brand: string;
  vendor_id: string;
  vendor_name: string;
  product_description: string;
  upc: string;
  system_sku: string;
  manufacturer_sku: string;
};

export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const collectionId = resolvedParams.id;
  const { data: session } = useSession();
  
  const [inputValue, setInputValue] = useState('');
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [rules, setRules] = useState<MappingRule[]>([]);
  const [collection, setCollection] = useState<any>(null);
  
  // Session duplicates Set
  const sessionScans = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitData();
  }, [collectionId]);

  const fetchInitData = async () => {
    // Fetch collection info
    const { data: colData } = await supabase.from('collections').select('*').eq('id', collectionId).single();
    if (colData) setCollection(colData);

    // Fetch active mapping rules
    const { data: rulesData } = await supabase
      .from('serial_mapping_rules')
      .select('*')
      .eq('active', true)
      .order('priority', { ascending: false });
    if (rulesData) setRules(rulesData);

    // Preload session duplicates for this collection
    const { data: existingScans } = await supabase
      .from('serial_scans')
      .select('normalized_serial_number')
      .eq('collection_id', collectionId);
    
    if (existingScans) {
      existingScans.forEach(s => sessionScans.current.add(s.normalized_serial_number));
    }
    
    inputRef.current?.focus();
  };

  const normalizeSerial = (serial: string) => {
    return serial.trim().replace(/\r?\n|\r/g, '');
  };

  const findMatchingRule = (normalized: string): MappingRule | null => {
    for (const rule of rules) {
      switch (rule.match_type) {
        case 'exact':
          if (normalized === rule.match_value) return rule;
          break;
        case 'prefix':
          if (normalized.startsWith(rule.match_value)) return rule;
          break;
        case 'contains':
          if (normalized.includes(rule.match_value)) return rule;
          break;
        case 'regex':
          try {
            const regex = new RegExp(rule.match_value);
            if (regex.test(normalized)) return rule;
          } catch (e) {
            // Ignore bad regex
          }
          break;
      }
    }
    return null;
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue || !session?.user?.email) return;

    const rawSerial = inputValue;
    const normalized = normalizeSerial(rawSerial);
    
    // Reset input instantly
    setInputValue('');
    inputRef.current?.focus();

    if (!normalized) return;

    const uiId = crypto.randomUUID();
    
    // Duplicate Check 1 & 2: Local Session / Preloaded Database
    if (sessionScans.current.has(normalized)) {
      const duplicateScan: ScanRow = {
        id: uiId,
        serial_number: rawSerial,
        normalized_serial_number: normalized,
        status: 'duplicate',
        timestamp: new Date()
      };
      setScans(prev => [duplicateScan, ...prev]);
      return;
    }

    sessionScans.current.add(normalized);

    // Local Mapping Match
    const matchedRule = findMatchingRule(normalized);
    const initialStatus: ScanRow['status'] = 'pending';

    // Add to UI state
    const newScanRow: ScanRow = {
      id: uiId,
      serial_number: rawSerial,
      normalized_serial_number: normalized,
      status: initialStatus,
      product_description: matchedRule?.product_description || 'Pending matching...',
      timestamp: new Date()
    };
    
    setScans(prev => [newScanRow, ...prev]);

    // Restriction Enforcement Check
    if (collection && matchedRule) {
      // 1. Brand Restrictions
      if (collection.restricted_brands) {
        const allowedBrands = collection.restricted_brands.split(',').map((b: string) => b.trim().toLowerCase());
        const scanBrand = matchedRule.brand?.toLowerCase();
        if (scanBrand && !allowedBrands.includes(scanBrand)) {
           setScans(prev => prev.map(s => s.id === uiId ? { 
             ...s, 
             status: 'error' as ScanRow['status'], 
             product_description: `Restricted: Brand "${matchedRule.brand}" is not allowed here.` 
           } : s));
           sessionScans.current.delete(normalized);
           return;
        }
      }

      // 2. SKU Restrictions
      if (collection.restricted_skus) {
        const allowedSkus = collection.restricted_skus.split(',').map((s: string) => s.trim().toLowerCase());
        const scanSku = matchedRule.system_sku?.toLowerCase();
        if (scanSku && !allowedSkus.includes(scanSku)) {
           setScans(prev => prev.map(s => s.id === uiId ? { 
             ...s, 
             status: 'error' as ScanRow['status'], 
             product_description: `Restricted: SKU "${matchedRule.system_sku}" is not allowed here.` 
           } : s));
           sessionScans.current.delete(normalized);
           return;
        }
      }
    }

    // Async Database Upload
    const match_status: ScanRow['status'] = matchedRule ? 'matched' : 'unmatched';
    
    const dbPayload = {
      collection_id: collectionId,
      serial_number: rawSerial,
      normalized_serial_number: normalized,
      match_status,
      mapping_rule_id: matchedRule?.id || null,
      scanned_by: session.user.email,
      brand: matchedRule?.brand || null,
      vendor_id: matchedRule?.vendor_id || null,
      vendor_name: matchedRule?.vendor_name || null,
      product_description: matchedRule?.product_description || null,
      upc: matchedRule?.upc || null,
      system_sku: matchedRule?.system_sku || null,
      manufacturer_sku: matchedRule?.manufacturer_sku || null,
    };

    const { error } = await supabase.from('serial_scans').insert([dbPayload]);

    if (error) {
      if (error.code === '23505') { // Unique constraint violation in postgres
        setScans(prev => prev.map(s => s.id === uiId ? { ...s, status: 'duplicate' as ScanRow['status'], product_description: 'Already scanned globally.' } : s));
      } else {
        setScans(prev => prev.map(s => s.id === uiId ? { ...s, status: 'error' as ScanRow['status'], product_description: 'Failed to save to database.' } : s));
        sessionScans.current.delete(normalized); // Remove from local cache so they can try again
      }
    } else {
      setScans(prev => prev.map(s => s.id === uiId ? { ...s, status: match_status, product_description: matchedRule?.product_description || 'No mapping found.' } : s));
    }
  };

  const getStatusIcon = (status: ScanRow['status']) => {
    switch (status) {
      case 'matched': return <CheckCircle2 className="text-success" size={20} />;
      case 'unmatched': return <CheckCircle2 className="text-warning" size={20} />;
      case 'duplicate': return <XCircle className="text-error" size={20} />;
      case 'error': return <AlertCircle className="text-error" size={20} />;
      case 'pending': return <Clock className="text-muted" size={20} />;
      default: return null;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="btn btn-outline" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 style={{ margin: 0 }}>Live Scanning</h1>
            <p className="text-muted">{collection?.name || 'Loading...'}</p>
          </div>
        </div>
        <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="text-muted text-sm">Session Scans</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{sessionScans.current.size}</div>
        </div>
      </div>

      <div className="card mb-6" style={{ backgroundColor: 'var(--primary-hover)', borderColor: 'var(--primary)' }}>
        <form onSubmit={handleScanSubmit}>
          <input 
            ref={inputRef}
            type="text" 
            className="input scan-input" 
            placeholder="SCAN SERIAL NUMBER HERE"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
            autoComplete="off"
            style={{ 
              backgroundColor: 'var(--surface)', 
              borderColor: 'var(--primary)',
              borderWidth: '2px',
              boxShadow: '0 0 15px rgba(37, 99, 235, 0.3)'
            }}
          />
        </form>
        <p className="text-center mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
          Scanner should submit with Enter automatically. Keep this input focused.
        </p>
      </div>

      <div>
        <h3 className="mb-4">Recent Scans</h3>
        <div className="flex flex-col gap-2">
          {scans.length === 0 ? (
            <div className="card text-center text-muted" style={{ padding: '3rem 1rem' }}>
              No scans yet in this session. Start scanning above!
            </div>
          ) : (
            scans.map(scan => (
              <div key={scan.id} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: scan.status === 'duplicate' || scan.status === 'error' ? 'var(--error-bg)' : 'var(--surface)' }}>
                <div className="flex items-center gap-4">
                  {getStatusIcon(scan.status)}
                  <div>
                    <div style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '1.1rem' }}>
                      {scan.normalized_serial_number}
                    </div>
                    <div className="text-sm text-muted">
                      {scan.product_description}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`badge badge-${scan.status === 'matched' ? 'success' : scan.status === 'duplicate' || scan.status === 'error' ? 'error' : scan.status === 'unmatched' ? 'warning' : 'neutral'}`}>
                    {scan.status}
                  </span>
                  <span className="text-xs text-muted">
                    {scan.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

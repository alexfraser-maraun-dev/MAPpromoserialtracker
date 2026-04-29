'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from 'next-auth/react';
import { Search, Save, Settings2, ShieldCheck, AlertTriangle } from 'lucide-react';

type ProductData = {
  upc: string;
  system_sku: string;
  manufacturer_sku: string;
  product_description: string;
  brand: string;
  vendor_id: string;
  vendor_name: string;
};

export default function ConfigPage() {
  const { data: session } = useSession();
  const [upcInput, setUpcInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [productData, setProductData] = useState<ProductData | null>(null);
  
  // Rule form
  const [matchType, setMatchType] = useState<'prefix' | 'contains' | 'regex' | 'exact'>('prefix');
  const [matchValue, setMatchValue] = useState('');
  const [prefixLength, setPrefixLength] = useState<number | ''>('');
  
  // Test rule
  const [testSerial, setTestSerial] = useState('');
  const [testResult, setTestResult] = useState<'match' | 'no-match' | null>(null);

  // Existing rules
  const [rules, setRules] = useState<any[]>([]);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    const { data } = await supabase.from('serial_mapping_rules').select('*').order('priority', { ascending: false });
    if (data) setRules(data);
  };

  const handleUpcSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upcInput) return;
    
    setIsSearching(true);
    setProductData(null);
    
    try {
      const res = await fetch(`/api/bigquery/lookup?upc=${encodeURIComponent(upcInput)}`);
      const data = await res.json();
      
      if (res.ok) {
        if (data.found) {
          setProductData(data.product);
        } else {
          // Init empty for manual entry
          setProductData({
            upc: upcInput,
            system_sku: '',
            manufacturer_sku: '',
            product_description: '',
            brand: '',
            vendor_id: '',
            vendor_name: ''
          });
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

  const getComputedMatchValue = () => {
    if (matchType === 'prefix' && prefixLength !== '' && typeof prefixLength === 'number' && prefixLength > 0) {
      return matchValue.substring(0, prefixLength);
    }
    return matchValue;
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalMatchValue = getComputedMatchValue();
    if (!productData || !finalMatchValue || !session?.user?.email) return;

    const payload = {
      ...productData,
      match_type: matchType,
      match_value: finalMatchValue,
      priority: 10,
      created_by: session.user.email,
      active: true
    };

    const { error } = editingRuleId 
      ? await supabase.from('serial_mapping_rules').update(payload).eq('id', editingRuleId)
      : await supabase.from('serial_mapping_rules').insert([payload]);

    if (!error) {
      alert(editingRuleId ? 'Mapping rule updated successfully!' : 'Mapping rule saved successfully!');
      fetchRules();
      setProductData(null);
      setUpcInput('');
      setMatchValue('');
      setTestSerial('');
      setPrefixLength('');
      setEditingRuleId(null);
    } else {
      alert('Failed to save mapping rule.');
    }
  };

  const startEdit = (rule: any) => {
    setEditingRuleId(rule.id);
    setProductData({
      upc: rule.upc,
      system_sku: rule.system_sku,
      manufacturer_sku: rule.manufacturer_sku,
      product_description: rule.product_description,
      brand: rule.brand,
      vendor_id: rule.vendor_id,
      vendor_name: rule.vendor_name
    });
    setMatchType(rule.match_type);
    setMatchValue(rule.match_value);
    setPrefixLength('');
    // Scroll to top of the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const testMatch = () => {
    const finalMatchValue = getComputedMatchValue();
    if (!testSerial || !finalMatchValue) return;
    
    let isMatch = false;
    switch (matchType) {
      case 'exact': isMatch = testSerial === finalMatchValue; break;
      case 'prefix': isMatch = testSerial.startsWith(finalMatchValue); break;
      case 'contains': isMatch = testSerial.includes(finalMatchValue); break;
      case 'regex': 
        try { isMatch = new RegExp(finalMatchValue).test(testSerial); } catch { isMatch = false; }
        break;
    }
    setTestResult(isMatch ? 'match' : 'no-match');
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    const { error } = await supabase.from('serial_mapping_rules').delete().eq('id', id);
    if (!error) fetchRules();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1>Mapping Config</h1>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6" style={{ alignItems: 'flex-start' }}>
        <div className="card">
          <h3 className="flex items-center gap-2 mb-4"><Search size={20} /> UPC Lookup</h3>
          <form onSubmit={handleUpcSearch} className="flex gap-4 mb-4">
            <input 
              type="text" 
              placeholder="Scan or enter UPC..." 
              className="input flex-1"
              value={upcInput}
              onChange={(e) => setUpcInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={isSearching}>
              {isSearching ? 'Looking up...' : 'Lookup'}
            </button>
          </form>

          {productData && (
            <form onSubmit={handleSaveRule} className="flex flex-col gap-4 mt-6 border-t pt-4">
              <div className="flex justify-between items-center">
                <h4>{editingRuleId ? 'Edit Mapping Rule' : 'Product Data'}</h4>
                {editingRuleId && (
                  <button type="button" onClick={() => {
                    setEditingRuleId(null);
                    setProductData(null);
                    setMatchValue('');
                  }} className="text-sm text-muted hover:text-text">Cancel Edit</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input className="input" placeholder="Product Description" value={productData.product_description} onChange={e => setProductData({...productData, product_description: e.target.value})} required />
                <input className="input" placeholder="Brand" value={productData.brand} onChange={e => setProductData({...productData, brand: e.target.value})} />
                <input className="input" placeholder="System SKU" value={productData.system_sku} onChange={e => setProductData({...productData, system_sku: e.target.value})} />
                <input className="input" placeholder="Manufacturer SKU" value={productData.manufacturer_sku} onChange={e => setProductData({...productData, manufacturer_sku: e.target.value})} />
                <input className="input" placeholder="Vendor ID" value={productData.vendor_id} onChange={e => setProductData({...productData, vendor_id: e.target.value})} />
                <input className="input" placeholder="Vendor Name" value={productData.vendor_name} onChange={e => setProductData({...productData, vendor_name: e.target.value})} />
              </div>

              <h4 className="mt-4">Serial Mapping Rule</h4>
              <div className="card mt-2 mb-4" style={{ backgroundColor: 'var(--background)' }}>
                <p className="text-sm text-muted mb-2">1. Scan an example serial number first (optional):</p>
                <input 
                  className="input w-full mb-4" 
                  placeholder="Scan Example Serial Number..." 
                  value={testSerial} 
                  onChange={e => {
                    const val = e.target.value;
                    setTestSerial(val);
                    setTestResult(null);
                    if (!matchValue && val) setMatchValue(val);
                  }} 
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                />
                <p className="text-sm text-muted mb-2">2. Define your rule.</p>
                <div className="flex gap-4 mb-2">
                  <select className="input" value={matchType} onChange={(e: any) => { setMatchType(e.target.value); setTestResult(null); }} style={{ width: '150px' }}>
                    <option value="prefix">Prefix Match</option>
                    <option value="exact">Exact Match</option>
                    <option value="contains">Contains</option>
                    <option value="regex">Regex</option>
                  </select>
                  <input className="input flex-1" placeholder="Match Value" value={matchValue} onChange={e => { setMatchValue(e.target.value); setTestResult(null); }} required />
                  
                  {matchType === 'prefix' && (
                    <input 
                      className="input" 
                      type="number" 
                      placeholder="Prefix Length" 
                      value={prefixLength} 
                      onChange={e => setPrefixLength(e.target.value ? parseInt(e.target.value) : '')} 
                      style={{ width: '120px' }} 
                      title="Number of characters to match" 
                    />
                  )}
                  
                  <button type="button" onClick={testMatch} className="btn btn-outline">Test Rule</button>
                </div>
                
                {matchType === 'prefix' && prefixLength !== '' && typeof prefixLength === 'number' && (
                  <p className="text-sm text-warning mb-2">
                    Saving prefix: <strong>{getComputedMatchValue()}</strong>
                  </p>
                )}

                {testResult === 'match' && <p className="text-success flex items-center gap-2 text-sm"><ShieldCheck size={16} /> The example serial matches this rule!</p>}
                {testResult === 'no-match' && <p className="text-error flex items-center gap-2 text-sm"><AlertTriangle size={16} /> The example serial does NOT match.</p>}
              </div>

              <button type="submit" className="btn btn-primary mt-4">
                <Save size={18} className="mr-2" /> 
                {editingRuleId ? 'Update Mapping Rule' : 'Save Rule'}
              </button>
            </form>
          )}
        </div>

        <div className="card flex flex-col">
          <h3 className="flex items-center gap-2 mb-4"><Settings2 size={20} /> Active Rules</h3>
          <div className="flex flex-col gap-2">
            {rules.map(rule => (
              <div key={rule.id} className="card relative group" style={{ padding: '0.75rem', backgroundColor: 'var(--background)' }}>
                <div className="flex justify-between items-start mb-1">
                  <strong style={{ paddingRight: '2rem' }}>{rule.product_description}</strong>
                </div>
                <div className="text-sm text-muted mb-2">{rule.brand} • {rule.system_sku}</div>
                <div className="flex justify-between items-center text-sm gap-2 mt-2">
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="badge badge-success" style={{ fontSize: '10px' }}>{rule.match_type}</span>
                    <code style={{ fontSize: '11px', wordBreak: 'break-all' }}>{rule.match_value}</code>
                  </div>
                  <div className="flex gap-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => startEdit(rule)} className="text-primary hover:underline">Edit</button>
                    <button type="button" onClick={() => deleteRule(rule.id)} className="text-error hover:underline">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

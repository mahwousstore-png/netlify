// src/hooks/useReceivables.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Entity {
  id: string;
  name: string;
  type: string;
  contact_info?: any;
  created_at: string;
}

interface Receivable {
  id: string;
  entity_id: string;
  description: string;
  total_amount: number;
  remaining_amount: number;
  due_date: string;
  purchase_date?: string;
  created_at: string;
}

export function useReceivables() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch entities
      const { data: entitiesData, error: entitiesError } = await supabase
        .from('entities')
        .select('*')
        .order('name');

      if (entitiesError) throw entitiesError;

      // Fetch receivables
      const { data: receivablesData, error: receivablesError } = await supabase
        .from('receivables')
        .select('*')
        .order('due_date');

      if (receivablesError) throw receivablesError;

      setEntities(entitiesData || []);
      setReceivables(receivablesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addEntity = async (entity: Partial<Entity>) => {
    const { data, error } = await supabase
      .from('entities')
      .insert(entity)
      .select()
      .single();

    if (error) throw error;
    await fetchData();
    return data;
  };

  const updateEntity = async (id: string, updates: Partial<Entity>) => {
    const { data, error } = await supabase
      .from('entities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await fetchData();
    return data;
  };

  const deleteEntity = async (id: string) => {
    const { error } = await supabase
      .from('entities')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchData();
  };

  const refresh = fetchData;

  return {
    entities,
    receivables,
    loading,
    addEntity,
    updateEntity,
    deleteEntity,
    refresh
  };
}

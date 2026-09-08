import { supabase } from '@/lib/supabase';
import type { PatientRecord } from '@/types';

export type NewPatient = Pick<PatientRecord, 'name'> & Pick<PatientRecord, 'date_of_birth' | 'notes' | 'interests' | 'share_with_caregiver'>;

export async function createPatient(patient: NewPatient) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Please sign in before adding a patient.');
  const name = patient.name.trim();
  if (!name) throw new Error('Patient name is required.');
  const { data, error } = await supabase.from('patients').insert({
    name,
    date_of_birth: patient.date_of_birth ?? null,
    notes: patient.notes ?? null,
    interests: patient.interests ?? null,
    share_with_caregiver: patient.share_with_caregiver ?? false,
    auth_user_id: authData.user.id,
  }).select().single();
  if (error) throw error;
  return data as PatientRecord;
}

export async function updatePatient(patientId: string, changes: Pick<PatientRecord, 'name' | 'date_of_birth' | 'notes' | 'interests'>) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('patients').update({
    name: changes.name.trim(),
    date_of_birth: changes.date_of_birth ?? null,
    notes: changes.notes ?? null,
    interests: changes.interests ?? null,
  }).eq('id', patientId).select().single();
  if (error) throw error;
  return data as PatientRecord;
}

/** Creates the signed-in patient's row only when the RLS-protected row is missing. */
export async function ensureCurrentUserPatient(name: string): Promise<PatientRecord | null> {
  if (!supabase) return null;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const user = authData.user;
  if (!user) return null;
  const { data: existing, error: lookupError } = await supabase
    .from('patients')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing as PatientRecord;
  const { data, error } = await supabase
    .from('patients')
    .insert({ auth_user_id: user.id, name: name.trim() || 'My profile', share_with_caregiver: false })
    .select()
    .single();
  if (error) throw error;
  return data as PatientRecord;
}

export async function listAuthorizedPatients() {
  if (!supabase) return [] as PatientRecord[];
  const { data, error } = await supabase.from('patients').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as PatientRecord[];
}

export async function setPatientAccess(patientId: string, status: 'pending' | 'active' | 'revoked') {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Please sign in before changing patient access.');
  const { error } = await supabase.from('caregiver_patient').upsert({ caregiver_id: authData.user.id, patient_id: patientId, status, granted_by: authData.user.id });
  if (error) throw error;
}

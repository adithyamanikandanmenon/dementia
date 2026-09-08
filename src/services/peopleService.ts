import { supabase } from '@/lib/supabase';
import type { PersonMemory } from '@/types';
import { isGuestPatientId } from './guestService';
import { storageService } from './storageService';

const bucket = 'patient-media';

export async function listPeople(patientId: string, useGuestStorage = false): Promise<PersonMemory[]> {
  if (useGuestStorage || isGuestPatientId(patientId)) {
    const people = await storageService.getPersonMemories();
    return people.filter((person) => person.patient_id === patientId).sort((a, b) => a.name.localeCompare(b.name));
  }
  if (!supabase) return [];
  const { data, error } = await supabase.from('person_memories').select('id, patient_id, name, relationship, nickname, photo_path, notes, voice_recording_path').eq('patient_id', patientId).order('created_at').limit(50);
  if (error) throw error;
  return (data ?? []) as PersonMemory[];
}

export async function savePerson(person: Partial<PersonMemory> & Pick<PersonMemory, 'patient_id' | 'name'>, photo?: File | null, voice?: File | null, useGuestStorage = false) {
  if (useGuestStorage || isGuestPatientId(person.patient_id)) {
    const localPerson: PersonMemory = {
      id: person.id ?? `guest-person-${crypto.randomUUID()}`,
      patient_id: person.patient_id,
      name: person.name.trim(),
      relationship: person.relationship ?? 'other',
      nickname: person.nickname ?? null,
      photo_path: null,
      notes: person.notes ?? null,
      voice_recording_path: null,
    };
    await storageService.putPersonMemory(localPerson);
    return localPerson;
  }
  if (!supabase) throw new Error('Supabase is not configured.');
  const client = supabase;
  const id = person.id ?? crypto.randomUUID();
  const optimisePhoto = async (file: File) => {
    if (!file.type.startsWith('image/') || file.size <= 900_000) return file;
    const bitmap = await createImageBitmap(file); const scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', .82));
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }) : file;
  };
  const upload = async (file: File, kind: 'people' | 'voice') => {
    const uploadFile = kind === 'people' ? await optimisePhoto(file) : file;
    const path = `${person.patient_id}/${kind}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await client.storage.from(bucket).upload(path, uploadFile, { upsert: true, contentType: uploadFile.type });
    if (error) throw error;
    return path;
  };
  const payload = { ...person, id, photo_path: photo ? await upload(photo, 'people') : person.photo_path ?? null, voice_recording_path: voice ? await upload(voice, 'voice') : person.voice_recording_path ?? null };
  const { data, error } = await client.from('person_memories').upsert(payload).select().single();
  if (error) throw error;
  return data as PersonMemory;
}

export async function removePerson(id: string, useGuestStorage = false) {
  if (useGuestStorage || id.startsWith('guest-person-')) {
    await storageService.deletePersonMemory(id);
    return;
  }
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('person_memories').delete().eq('id', id);
  if (error) throw error;
}

export async function personPhotoUrl(path: string | null, useGuestStorage = false) {
  if (useGuestStorage || !supabase || !path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

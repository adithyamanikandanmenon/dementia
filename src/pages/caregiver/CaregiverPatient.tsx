import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { useSettings } from '@/hooks/useSettings';
import { useProgressData } from '@/hooks/useProgressData';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured } from '@/lib/supabase';
import { createPatient, listAuthorizedPatients } from '@/services/patientService';
import type { PatientRecord } from '@/types';
import { ageFromDateOfBirth, dateOfBirthFromAge } from '@/utils/date';

const GAME_LABEL: Record<string, string> = {
  'picture-pairs': 'games.picturePairs',
  'pattern-recall': 'games.patternRecall',
  'daily-routine': 'games.dailyRoutine',
};

const MIN_PATIENT_AGE = 1;
const MAX_PATIENT_AGE = 120;

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function CaregiverPatient() {
  const { t } = useI18n();
  const { settings, updateActiveProfile } = useSettings();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [patientMessage, setPatientMessage] = useState('');
  const [patientsLoading, setPatientsLoading] = useState(isSupabaseConfigured);
  const [addOpen, setAddOpen] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientAge, setNewPatientAge] = useState('');
  const [newPatientNotes, setNewPatientNotes] = useState('');
  const [addingPatient, setAddingPatient] = useState(false);
  const { recentSessions } = useProgressData();

  useEffect(() => {
    if (!isSupabaseConfigured) { setPatientsLoading(false); return; }
    setPatientsLoading(true);
    listAuthorizedPatients()
      .then(setPatients)
      .catch((error) => setPatientMessage(error instanceof Error ? error.message : 'Unable to load authorized patients.'))
      .finally(() => setPatientsLoading(false));
  }, []);

  const openAddPatient = () => {
    setPatientMessage('');
    setNewPatientName('');
    setNewPatientAge('');
    setNewPatientNotes('');
    setAddOpen(true);
  };

  const addPatient = async () => {
    const name = newPatientName.trim();
    const age = Number(newPatientAge);
    if (!name) { setPatientMessage('Enter the patient’s name.'); return; }
    if (!Number.isInteger(age) || age < MIN_PATIENT_AGE || age > MAX_PATIENT_AGE) {
      setPatientMessage(`Enter an age from ${MIN_PATIENT_AGE} to ${MAX_PATIENT_AGE}.`);
      return;
    }
    setAddingPatient(true);
    setPatientMessage('');
    try {
      const created = await createPatient({
        name,
        date_of_birth: dateOfBirthFromAge(age),
        notes: newPatientNotes.trim() || null,
        share_with_caregiver: true,
      });
      setPatients((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      updateActiveProfile({ id: created.id, patientName: created.name });
      setAddOpen(false);
      setPatientMessage(`${created.name} was added successfully.`);
    } catch (error) {
      setPatientMessage(error instanceof Error ? error.message : 'Unable to add this patient. Please try again.');
    } finally {
      setAddingPatient(false);
    }
  };

  const patient = settings.patientName.trim() || 'Patient';
  const readScreen = `${t('caregiver.patientProfile')}. ${patient}.`;

  return (
    <>
      <AppHeader subtitle={t('nav.patient')} readText={readScreen} />
      <main className="page">
        <div className="stack-lg">
          {isSupabaseConfigured && <Card>
            <div className="row-between patient-list-heading">
              <div><h2 className="card-title">Choose patient</h2><p className="muted">Only patients linked to this account are shown.</p></div>
              <Button type="button" variant="secondary" icon="plus" onClick={openAddPatient}>Add Patient</Button>
            </div>
            {patientsLoading ? <p className="muted" role="status">Loading patients…</p> : patients.length === 0 ? <div className="patient-empty stack-sm"><p className="muted">No patients yet.</p><Button type="button" variant="ghost" onClick={openAddPatient}>Add your first patient</Button></div> : patients.map((candidate) => <button type="button" className="link-row" key={candidate.id} onClick={() => updateActiveProfile({ id: candidate.id, patientName: candidate.name })}><div><strong>{candidate.name}</strong><div className="muted">{candidate.id === settings.activePatientId ? 'Current patient' : 'Select patient'}{ageFromDateOfBirth(candidate.date_of_birth) !== null ? ` · Age ${ageFromDateOfBirth(candidate.date_of_birth)}` : ''}</div></div><Icon name="chevron-right" size={20} /></button>)}
            {patientMessage && <p className="muted" role="status">{patientMessage}</p>}
          </Card>}
          <div>
            <h1 className="page-title">{t('caregiver.patientProfile')}</h1>
          </div>

          {/* Profile */}
          <Card padLg>
            <div className="row" style={{ gap: '0.9rem' }}>
              <span
                aria-hidden="true"
                style={{
                  width: '3.5rem',
                  height: '3.5rem',
                  borderRadius: '9999px',
                  background: 'var(--secondary-container)',
                  color: 'var(--secondary-dark)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                }}
              >
                {patient.charAt(0)}
              </span>
              <div>
                <h2 className="card-title">{patient}</h2>
                <p className="muted">{t('caregiver.relationFather')} · {t('caregiver.device')}</p>
                {settings.activePatientId && patients.find((candidate) => candidate.id === settings.activePatientId)?.date_of_birth && <p className="muted">Age {ageFromDateOfBirth(patients.find((candidate) => candidate.id === settings.activePatientId)?.date_of_birth)}</p>}
              </div>
            </div>
          </Card>

          {/* Emergency contact */}
          <Card>
            <div className="metric-row">
              <div className="row" style={{ gap: '0.6rem' }}>
                <Icon name="phone" size={22} />
                <strong>{t('settings.emergencyTitle')}</strong>
              </div>
              <span className="pill">{settings.emergencyContact}</span>
            </div>
            <div className="metric-row">
              <div className="row" style={{ gap: '0.6rem' }}>
                <Icon name="users" size={22} />
                <strong>{t('settings.familyTitle')}</strong>
              </div>
              <span className="pill">{settings.caregiverName}</span>
            </div>
          </Card>
          <div className="grid-2"><Button variant="secondary" block onClick={() => navigate('/caregiver/people')}>My People</Button><Button variant="secondary" block onClick={() => navigate('/caregiver/reminders')}>Reminders</Button></div>

          {/* Recent sessions */}
          <Card>
            <h2 className="card-title" style={{ marginBottom: '0.5rem' }}>
              {t('caregiver.recentSessions')}
            </h2>
            {recentSessions.length === 0 ? (
              <p className="muted">{t('caregiver.noSessions')}</p>
            ) : (
              <div>
                {recentSessions.map((s) => (
                  <div className="metric-row" key={s.id}>
                    <div>
                      <strong>{t(GAME_LABEL[s.gameType])}</strong>
                      <div className="muted">
                        {t('home.level')} {s.level} · {timeAgo(s.timestamp)}
                      </div>
                    </div>
                    <span className="pill pill--green">{s.score}%</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <p className="disclaimer">{t('caregiver.trendDisclaimer')}</p>
        </div>
      </main>
      <Sheet open={addOpen} title="Add Patient" onClose={() => { if (!addingPatient) setAddOpen(false); }}>
        <form className="stack" onSubmit={(event) => { event.preventDefault(); void addPatient(); }}>
          <div className="field"><label className="field__label" htmlFor="new-patient-name">Patient name</label><input id="new-patient-name" className="input" value={newPatientName} onChange={(event) => setNewPatientName(event.target.value)} autoComplete="name" autoFocus /></div>
          <div className="field"><label className="field__label" htmlFor="new-patient-age">Age</label><input id="new-patient-age" className="input" value={newPatientAge} onChange={(event) => setNewPatientAge(event.target.value.replace(/\D/g, '').slice(0, 3))} type="number" inputMode="numeric" min={MIN_PATIENT_AGE} max={MAX_PATIENT_AGE} step="1" placeholder={`${MIN_PATIENT_AGE}–${MAX_PATIENT_AGE}`} required /><small className="muted">Use a whole number from {MIN_PATIENT_AGE} to {MAX_PATIENT_AGE}. We store the calculated date of birth.</small></div>
          <div className="field"><label className="field__label" htmlFor="new-patient-notes">Notes (optional)</label><textarea id="new-patient-notes" className="input" value={newPatientNotes} onChange={(event) => setNewPatientNotes(event.target.value)} /></div>
          <div className="sheet-actions"><Button type="button" variant="ghost" onClick={() => setAddOpen(false)} disabled={addingPatient}>Cancel</Button><Button type="submit" icon="check" disabled={addingPatient}>{addingPatient ? 'Adding…' : 'Add Patient'}</Button></div>
        </form>
      </Sheet>
    </>
  );
}

// Mizo (Mizo ṭawng) — genuine partial locale.
// Mizo uses the Latin script. Confident translations only; the rest
// falls back to English so the app is always fully readable.
import type { LocaleDict } from '../index';

const lus: LocaleDict = {
  common: {
    continue: 'Zawm rawh',
    back: 'Kir leh',
    yes: 'Aw',
    no: 'Aih',
    close: 'Khar',
  },
  nav: {
    home: 'In',
    games: 'Infiamna',
    reminders: 'Hriattirna',
    settings: 'Siamremna',
  },
  welcome: {
    getStarted: 'Ṭan rawh',
    goodMorning: 'Zing ṭha',
  },
  language: {
    title: 'I ṭawng thlang rawh',
  },
  games: {
    play: 'Infiam rawh',
  },
};

export default lus;

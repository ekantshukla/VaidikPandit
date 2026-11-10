// Regional Hindu calendars of India. The tithi, nakshatra, yoga and muhurat are the same everywhere; what differs
// is how months are named and counted, the era (samvat) and the new year:
//  • Lunar, Purnimanta (month ends on Purnima): North India, Kashmir. Vikram Samvat from Chaitra Shukla 1.
//  • Lunar, Amanta (month ends on Amavasya): Maharashtra, Goa, Karnataka, Andhra, Telangana (Shaka; Gudi Padwa / Ugadi)
//    and Gujarat (Vikram Samvat changes on Kartik Shukla 1, the day after Diwali).
//  • Solar (month = the Sun's sidereal sign; starts on Sankranti): Tamil Nadu, Kerala, Bengal, Odisha, Assam, Punjab, Nepal.
//    Each region has its own rule for which civil day is the 1st of the month when the Sankranti falls late in the day.
import { findAngleCrossing, fromJd, sunSidereal, toJd } from './astro';
import { MonthSystem, PanchangResult } from './models';
import { MASA, MASA_SA } from './names';
import { addDays, isoLocal, lunarMonth, sunEvent, tzOffsetMinutes } from './panchang-engine';
import { Script, toScript } from '../services/transliterate';

export type CalId = 'north' | 'kashmiri' | 'gujarati' | 'marathi' | 'kannada' | 'telugu' | 'tamil' | 'malayalam' | 'bengali' | 'odia' | 'assamese' | 'punjabi' | 'nepali';
type SolarRule = 'sunset' | 'aparahna' | 'nextDay' | 'sameDay';
export interface RegionalCal {
  id: CalId; en: string; hi: string; where: string; whereHi: string;
  system: MonthSystem; solar?: { months: string[]; native: string[]; rule: SolarRule };
  script: Script;
}
const T = (s: string) => s.split(',').map(x => x.trim());

export const CALENDARS: RegionalCal[] = [
  { id: 'north', en: 'North Indian (Purnimanta)', hi: 'उत्तर भारतीय (पूर्णिमांत)', where: 'UP, Bihar, MP, Rajasthan, Delhi, Haryana, Uttarakhand, Himachal, Jharkhand, Chhattisgarh', whereHi: 'उ.प्र., बिहार, म.प्र., राजस्थान, दिल्ली, हरियाणा, उत्तराखंड, हिमाचल, झारखंड, छत्तीसगढ़', system: 'Purnimanta', script: 'deva' },
  { id: 'kashmiri', en: 'Kashmiri (Saptarishi Samvat)', hi: 'कश्मीरी (सप्तर्षि संवत्)', where: 'Jammu & Kashmir', whereHi: 'जम्मू-कश्मीर', system: 'Purnimanta', script: 'deva' },
  { id: 'gujarati', en: 'Gujarati (Amanta, Kartikadi)', hi: 'गुजराती (अमांत, कार्तिकादि)', where: 'Gujarat, Daman & Diu, Dadra', whereHi: 'गुजरात, दमण-दीव, दादरा', system: 'Amanta', script: 'gujr' },
  { id: 'marathi', en: 'Marathi / Konkani (Amanta, Shaka)', hi: 'मराठी / कोंकणी (अमांत, शक)', where: 'Maharashtra, Goa', whereHi: 'महाराष्ट्र, गोवा', system: 'Amanta', script: 'deva' },
  { id: 'kannada', en: 'Kannada (Amanta, Chandramana)', hi: 'कन्नड़ (अमांत, चांद्रमान)', where: 'Karnataka', whereHi: 'कर्नाटक', system: 'Amanta', script: 'knda' },
  { id: 'telugu', en: 'Telugu (Amanta, Chandramana)', hi: 'तेलुगु (अमांत, चांद्रमान)', where: 'Andhra Pradesh, Telangana', whereHi: 'आंध्र प्रदेश, तेलंगाना', system: 'Amanta', script: 'telu' },
  { id: 'tamil', en: 'Tamil (Solar)', hi: 'तमिल (सौर)', where: 'Tamil Nadu, Puducherry', whereHi: 'तमिलनाडु, पुदुचेरी', system: 'Amanta', script: 'taml',
    solar: { rule: 'sunset', months: T('Chithirai, Vaikasi, Aani, Aadi, Avani, Purattasi, Aippasi, Karthigai, Margazhi, Thai, Maasi, Panguni'),
      native: T('சித்திரை, வைகாசி, ஆனி, ஆடி, ஆவணி, புரட்டாசி, ஐப்பசி, கார்த்திகை, மார்கழி, தை, மாசி, பங்குனி') } },
  { id: 'malayalam', en: 'Malayalam (Solar, Kollam era)', hi: 'मलयालम (सौर, कोल्लम संवत्)', where: 'Kerala, Lakshadweep', whereHi: 'केरल, लक्षद्वीप', system: 'Amanta', script: 'mlym',
    solar: { rule: 'aparahna', months: T('Medam, Edavam, Mithunam, Karkidakam, Chingam, Kanni, Thulam, Vrischikam, Dhanu, Makaram, Kumbham, Meenam'),
      native: T('മേടം, ഇടവം, മിഥുനം, കർക്കിടകം, ചിങ്ങം, കന്നി, തുലാം, വൃശ്ചികം, ധനു, മകരം, കുംഭം, മീനം') } },
  { id: 'bengali', en: 'Bengali (Solar, Bangabda)', hi: 'बंगाली (सौर, बंगाब्द)', where: 'West Bengal, Tripura, Andaman', whereHi: 'पश्चिम बंगाल, त्रिपुरा, अंडमान', system: 'Purnimanta', script: 'beng',
    solar: { rule: 'nextDay', months: T('Boishakh, Joishtho, Asharh, Shrabon, Bhadro, Ashshin, Kartik, Ogrohayon, Poush, Magh, Falgun, Choitro'),
      native: T('বৈশাখ, জ্যৈষ্ঠ, আষাঢ়, শ্রাবণ, ভাদ্র, আশ্বিন, কার্তিক, অগ্রহায়ণ, পৌষ, মাঘ, ফাল্গুন, চৈত্র') } },
  { id: 'odia', en: 'Odia (Solar)', hi: 'ओड़िया (सौर)', where: 'Odisha', whereHi: 'ओडिशा', system: 'Purnimanta', script: 'deva',
    solar: { rule: 'sameDay', months: T('Baisakha, Jyeshtha, Ashadha, Shrabana, Bhadraba, Ashwina, Kartika, Margashira, Pausha, Magha, Phalguna, Chaitra'),
      native: T('ବୈଶାଖ, ଜ୍ୟେଷ୍ଠ, ଆଷାଢ଼, ଶ୍ରାବଣ, ଭାଦ୍ରବ, ଆଶ୍ୱିନ, କାର୍ତ୍ତିକ, ମାର୍ଗଶିର, ପୌଷ, ମାଘ, ଫାଲ୍ଗୁନ, ଚୈତ୍ର') } },
  { id: 'assamese', en: 'Assamese (Solar)', hi: 'असमिया (सौर)', where: 'Assam & the North-East', whereHi: 'असम व पूर्वोत्तर', system: 'Purnimanta', script: 'beng',
    solar: { rule: 'nextDay', months: T('Bohag, Jeth, Aahar, Xaon, Bhado, Aahin, Kati, Aghon, Puh, Magh, Phagun, Sot'),
      native: T("ব'হাগ, জেঠ, আহাৰ, শাওন, ভাদ, আহিন, কাতি, আঘোন, পুহ, মাঘ, ফাগুন, চ'ত") } },
  { id: 'punjabi', en: 'Punjabi (Bikrami, Solar months)', hi: 'पंजाबी (बिक्रमी, सौर मास)', where: 'Punjab, Chandigarh', whereHi: 'पंजाब, चंडीगढ़', system: 'Purnimanta', script: 'deva',
    solar: { rule: 'sameDay', months: T('Vaisakh, Jeth, Harh, Sawan, Bhadon, Assu, Katak, Maghar, Poh, Magh, Phaggan, Chet'),
      native: T('ਵੈਸਾਖ, ਜੇਠ, ਹਾੜ੍ਹ, ਸਾਵਣ, ਭਾਦੋਂ, ਅੱਸੂ, ਕੱਤਕ, ਮੱਘਰ, ਪੋਹ, ਮਾਘ, ਫੱਗਣ, ਚੇਤ') } },
  { id: 'nepali', en: 'Nepali (Bikram Sambat, Solar)', hi: 'नेपाली (बिक्रम संवत्, सौर)', where: 'Sikkim, Darjeeling, Nepal', whereHi: 'सिक्किम, दार्जिलिंग, नेपाल', system: 'Purnimanta', script: 'deva',
    solar: { rule: 'sameDay', months: T('Baisakh, Jestha, Asar, Shrawan, Bhadra, Asoj, Kartik, Mangsir, Poush, Magh, Falgun, Chaitra'),
      native: T('बैशाख, जेठ, असार, साउन, भदौ, असोज, कात्तिक, मंसिर, पुस, माघ, फागुन, चैत') } },
];

const BY_STATE: Record<string, CalId> = {
  'Jammu & Kashmir': 'kashmiri', 'Ladakh': 'kashmiri', 'Gujarat': 'gujarati', 'Dadra & Nagar Haveli and Daman & Diu': 'gujarati',
  'Maharashtra': 'marathi', 'Goa': 'marathi', 'Karnataka': 'kannada', 'Andhra Pradesh': 'telugu', 'Telangana': 'telugu',
  'Tamil Nadu': 'tamil', 'Puducherry': 'tamil', 'Kerala': 'malayalam', 'Lakshadweep': 'malayalam',
  'West Bengal': 'bengali', 'Tripura': 'bengali', 'Andaman & Nicobar Islands': 'bengali', 'Odisha': 'odia',
  'Assam': 'assamese', 'Arunachal Pradesh': 'assamese', 'Meghalaya': 'assamese', 'Manipur': 'assamese', 'Mizoram': 'assamese', 'Nagaland': 'assamese',
  'Punjab': 'punjabi', 'Chandigarh': 'punjabi', 'Sikkim': 'nepali',
};
const BY_LANG: Record<string, CalId> = { gu: 'gujarati', mr: 'marathi', kn: 'kannada', te: 'telugu', ta: 'tamil', bn: 'bengali' };
/** Best guess of the reader's calendar: from the chosen place's state, else from the app language. */
export function defaultCalendar(state: string | undefined, lang: string): CalId {
  return (state && BY_STATE[state]) || BY_LANG[lang] || 'north';
}
export const calendar = (id: string) => CALENDARS.find(c => c.id === id) ?? CALENDARS[0];

// 60-year Jovian cycle (samvatsara) used for the year name in Karnataka, Andhra, Telangana, Maharashtra and Tamil Nadu.
const SAMVATSARA = T('Prabhava, Vibhava, Shukla, Pramoda, Prajapati, Angirasa, Shrimukha, Bhava, Yuva, Dhatri, Ishvara, Bahudhanya, Pramathi, Vikrama, Vrisha, Chitrabhanu, Svabhanu, Tarana, Parthiva, Vyaya, Sarvajit, Sarvadhari, Virodhi, Vikriti, Khara, Nandana, Vijaya, Jaya, Manmatha, Durmukhi, Hevilambi, Vilambi, Vikari, Sharvari, Plava, Shubhakrit, Shobhakrit, Krodhi, Vishvavasu, Parabhava, Plavanga, Kilaka, Saumya, Sadharana, Virodhikrit, Paridhavi, Pramadi, Ananda, Rakshasa, Nala, Pingala, Kalayukti, Siddharthi, Raudri, Durmati, Dundubhi, Rudhirodgari, Raktakshi, Krodhana, Akshaya');
const SAMVATSARA_SA = T('प्रभव, विभव, शुक्ल, प्रमोद, प्रजापति, अङ्गिरा, श्रीमुख, भाव, युवा, धाता, ईश्वर, बहुधान्य, प्रमाथी, विक्रम, वृष, चित्रभानु, स्वभानु, तारण, पार्थिव, व्यय, सर्वजित्, सर्वधारी, विरोधी, विकृति, खर, नन्दन, विजय, जय, मन्मथ, दुर्मुखी, हेविलम्बी, विलम्बी, विकारी, शार्वरी, प्लव, शुभकृत्, शोभकृत्, क्रोधी, विश्वावसु, पराभव, प्लवङ्ग, कीलक, सौम्य, साधारण, विरोधिकृत्, परिधावी, प्रमादी, आनन्द, राक्षस, नल, पिङ्गल, कालयुक्ति, सिद्धार्थी, रौद्र, दुर्मति, दुन्दुभि, रुधिरोद्गारी, रक्ताक्षी, क्रोधन, अक्षय');
/** Shaka year S (which starts on Chaitra Shukla 1) → samvatsara. Shaka 1946 (2024–25) = Krodhi. */
const samvatsaraIdx = (shaka: number) => (((shaka - 1909) % 60) + 60) % 60;

const TITHI_NAMES = T('Pratipada, Dwitiya, Tritiya, Chaturthi, Panchami, Shashthi, Saptami, Ashtami, Navami, Dashami, Ekadashi, Dwadashi, Trayodashi, Chaturdashi');
const TITHI_SA = T('प्रतिपदा, द्वितीया, तृतीया, चतुर्थी, पञ्चमी, षष्ठी, सप्तमी, अष्टमी, नवमी, दशमी, एकादशी, द्वादशी, त्रयोदशी, चतुर्दशी');

export interface Txt { en: string; native: string; }
export interface RegionalDay {
  cal: RegionalCal;
  /** The date as people of that region write it, e.g. "Aippasi 24" / "ஐப்பசி 24", or "Kartik Krishna Saptami". */
  date: Txt;
  /** Lunar month line for the solar calendars (festivals there still follow tithis). */
  lunar?: Txt;
  /** Era / year lines, e.g. "Kollam 1202", "Bangabda 1433", "Shaka 1948 · Parabhava". */
  years: Txt[];
  /** Regional new year / month-start festivals falling today. */
  festivals: Txt[];
}

const native = (deva: string, sc: Script) => (sc === 'deva' ? deva : toScript(deva, sc));

/** The civil date (YYYY-MM-DD) in `tz` of a Julian day. */
const dateOf = (jd: number, tz: string) => isoLocal(fromJd(jd), tz).slice(0, 10);
function dayFrame(date: string, lat: number, lng: number, tz: string) {
  const [y, m, d] = date.split('-').map(Number);
  const offMin = tzOffsetMinutes(tz, Date.UTC(y, m - 1, d, 12) - 5.5 * 3600000);
  const jdMid = toJd(Date.UTC(y, m - 1, d) - offMin * 60000);
  const r = sunEvent(jdMid, offMin / 60, lat, lng, true) ?? jdMid + 0.25;
  const s = sunEvent(jdMid, offMin / 60, lat, lng, false) ?? jdMid + 0.75;
  return { jdMid, r, s };
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

/** Civil date that is day 1 of the solar month whose Sankranti happens at `sk`, by the region's rule. */
function monthStart(sk: number, rule: SolarRule, lat: number, lng: number, tz: string): string {
  const d = dateOf(sk, tz);
  const f = dayFrame(d, lat, lng, tz);
  switch (rule) {
    case 'sunset': return sk < f.s ? d : addDays(d, 1);                              // Tamil Nadu
    case 'aparahna': return sk < f.r + (f.s - f.r) * 0.6 ? d : addDays(d, 1);        // Kerala: before 3/5 of the daytime
    case 'nextDay': return addDays(d, 1);                                             // Bengal, Assam
    case 'sameDay': return sk < f.r ? addDays(d, -1) : d;                             // Odisha, Punjab, Nepal: the Hindu day of the Sankranti
  }
}

/** Solar month (0 = Mesha) and day number for a civil date. */
export function solarDate(date: string, rule: SolarRule, lat: number, lng: number, tz: string): { month: number; day: number } {
  const { r } = dayFrame(date, lat, lng, tz);
  let k = Math.floor(sunSidereal(r + 1) / 30);       // sign by the next sunrise, so a Sankranti later today is included
  for (let tries = 0; tries < 3; tries++) {
    const sk = findAngleCrossing(sunSidereal, k * 30, r + 1 - 33, 34, 0.5);
    if (sk !== null) {
      const start = monthStart(sk, rule, lat, lng, tz);
      const day = daysBetween(start, date) + 1;
      if (day >= 1) return { month: k, day };
    }
    k = (k + 11) % 12;                               // the month has not begun yet by this rule: still the previous one
  }
  return { month: Math.floor(sunSidereal(r) / 30), day: 1 };
}

/** Everything the regional card shows for one day. */
export function regionalDay(id: CalId, p: PanchangResult): RegionalDay {
  const cal = calendar(id);
  const riseJd = toJd(Date.parse(p.sunrise ?? p.date + 'T06:00:00Z'));
  const { masa: amantaMasa, adhik } = lunarMonth(riseJd);
  const [y, m] = p.date.split('-').map(Number);
  const sc = cal.script;
  const t = p.tithis[0]?.number ?? 1;
  const shukla = t <= 15;
  const tIdx = t === 15 || t === 30 ? -1 : (t - 1) % 15;
  const tithiEn = t === 15 ? 'Purnima' : t === 30 ? 'Amavasya' : TITHI_NAMES[tIdx];
  const tithiSa = t === 15 ? 'पूर्णिमा' : t === 30 ? 'अमावस्या' : TITHI_SA[tIdx];
  const masaIdx = cal.system === 'Purnimanta' && t > 15 ? (amantaMasa + 1) % 12 : amantaMasa;
  const adh = adhik ? 'Adhik ' : '', adhSa = adhik ? 'अधिक ' : '';
  const lunar: Txt = {
    en: `${adh}${MASA[masaIdx]} ${shukla ? 'Shukla' : 'Krishna'} ${tithiEn}`,
    native: native(`${adhSa}${MASA_SA[masaIdx]} ${shukla ? 'शुक्ल' : 'कृष्ण'} ${tithiSa}`, sc),
  };
  const vikram = p.vikramSamvat, shaka = p.shakaSamvat;
  const sv = samvatsaraIdx(shaka);
  const svTxt: Txt = { en: SAMVATSARA[sv] + ' samvatsara', native: native(SAMVATSARA_SA[sv] + ' संवत्सर', sc) };
  const years: Txt[] = [];
  const festivals: Txt[] = [];
  const fest = (en: string, nat: string) => festivals.push({ en, native: nat });
  // Pratipada is "kshaya" when it begins after sunrise and ends before the next sunrise: the festival is kept on that day.
  const kshayaPratipada = p.tithis.some((x, i) => i > 0 && x.number === 1 && i < p.tithis.length - 1);
  const firstOf = (masa: number) => !adhik && ((amantaMasa === masa && t === 1) || (amantaMasa === (masa + 11) % 12 && t === 30 && kshayaPratipada));
  const chaitra1 = firstOf(0);

  let date = lunar;
  let solar: { month: number; day: number } | null = null;
  if (cal.solar) {
    solar = solarDate(p.date, cal.solar.rule, p.latitude, p.longitude, p.timeZone);
    date = { en: `${cal.solar.months[solar.month]} ${solar.day}`, native: `${cal.solar.native[solar.month]} ${solar.day}` };
  }

  switch (id) {
    case 'north':
      years.push({ en: `Vikram Samvat ${vikram}`, native: `विक्रम संवत् ${vikram}` }, { en: `Shaka ${shaka}`, native: `शक ${shaka}` });
      if (chaitra1) fest('Hindu Nav Varsh · Chaitra Navratri begins', 'हिंदू नववर्ष · चैत्र नवरात्रि आरंभ');
      break;
    case 'kashmiri':
      years.push({ en: `Saptarishi Samvat ${vikram + 3019}`, native: `सप्तर्षि संवत् ${vikram + 3019}` }, { en: `Vikram Samvat ${vikram}`, native: `विक्रम संवत् ${vikram}` });
      if (chaitra1) fest('Navreh (Kashmiri New Year)', 'नवरेह (कश्मीरी नववर्ष)');
      break;
    case 'gujarati': {
      // Gujarati Vikram Samvat starts on Kartik Shukla 1, so from Chaitra to Ashvin it is one less than the North Indian year.
      const gv = amantaMasa <= 6 ? vikram - 1 : vikram;
      years.push({ en: `Vikram Samvat ${gv}`, native: native(`विक्रम संवत् ${gv}`, sc) });
      if (firstOf(7)) fest('Bestu Varas (Gujarati New Year)', native('बेसतुं वरस (गुजराती नववर्ष)', sc));
      break;
    }
    case 'marathi':
      years.push({ en: `Shaka ${shaka}`, native: `शके ${shaka}` }, svTxt);
      if (chaitra1) fest('Gudi Padwa (Marathi New Year)', 'गुढीपाडवा (मराठी नववर्ष)');
      break;
    case 'kannada': case 'telugu':
      years.push(svTxt, { en: `Shaka ${shaka}`, native: native(`शक ${shaka}`, sc) });
      if (chaitra1) fest('Ugadi (New Year)', native('युगादि', sc));
      break;
    case 'tamil': {
      // Tamil year (same 60 names) begins on Chithirai 1
      const idx = solarYearSamvatsara(p.date, solar!.month);
      years.push({ en: `${SAMVATSARA[idx]} year`, native: toScript(SAMVATSARA_SA[idx], 'taml') + ' ஆண்டு' }, { en: `Thiruvalluvar ${tvYear(y, m, solar!.month)}`, native: `திருவள்ளுவர் ஆண்டு ${tvYear(y, m, solar!.month)}` });
      if (solar!.day === 1 && solar!.month === 0) fest('Puthandu (Tamil New Year)', 'புத்தாண்டு');
      if (solar!.day === 1 && solar!.month === 9) fest('Thai Pongal', 'தைப் பொங்கல்');
      if (solar!.month === 7 && p.nakshatras[0]?.number === 3 && t >= 13 && t <= 16) fest('Karthigai Deepam', 'கார்த்திகை தீபம்');
      break;
    }
    case 'malayalam': {
      const me = solar!.month >= 4 && m >= 8 ? y - 824 : y - 825;
      years.push({ en: `Kollam Era ${me}`, native: `കൊല്ലവർഷം ${me}` });
      if (solar!.day === 1 && solar!.month === 4) fest('Chingam 1 (Malayalam New Year)', 'ചിങ്ങം 1 (പുതുവർഷം)');
      if (solar!.day === 1 && solar!.month === 0) fest('Vishu', 'വിഷു');
      if (solar!.month === 4 && p.nakshatras[0]?.number === 22) fest('Thiruvonam (Onam)', 'തിരുവോണം');
      break;
    }
    case 'bengali': {
      const bs = afterBaisakh(y, m, solar!.month) ? y - 593 : y - 594;
      years.push({ en: `Bangabda ${bs}`, native: `বঙ্গাব্দ ${toBengaliDigits(bs)}` });
      if (solar!.day === 1 && solar!.month === 0) fest('Pohela Boishakh (Bengali New Year)', 'পহেলা বৈশাখ');
      break;
    }
    case 'assamese': {
      const bs = afterBaisakh(y, m, solar!.month) ? y - 593 : y - 594;
      years.push({ en: `Bhaskarabda ${bs}`, native: `ভাস্কৰাব্দ ${toBengaliDigits(bs)}` }, { en: `Shaka ${shaka}`, native: `শক ${toBengaliDigits(shaka)}` });
      if (solar!.day === 1 && solar!.month === 0) fest('Bohag (Rongali) Bihu · Manuh Bihu', "ব'হাগ বিহু");
      if (solar!.month === 11 && solarDate(addDays(p.date, 1), 'nextDay', p.latitude, p.longitude, p.timeZone).day === 1) fest('Goru Bihu', 'গৰু বিহু');
      if (solar!.day === 1 && solar!.month === 9) fest('Magh (Bhogali) Bihu', 'মাঘ বিহু');
      if (solar!.month === 8 && solarDate(addDays(p.date, 1), 'nextDay', p.latitude, p.longitude, p.timeZone).day === 1) fest('Uruka (eve of Magh Bihu)', 'উৰুকা');
      if (solar!.day === 1 && solar!.month === 6) fest('Kati (Kongali) Bihu', 'কাতি বিহু');
      break;
    }
    case 'odia':
      years.push({ en: `Shaka ${shaka}`, native: `ଶକାବ୍ଦ ${shaka}` }, { en: `Vikram Samvat ${vikram}`, native: `ବିକ୍ରମ ସମ୍ବତ ${vikram}` });
      if (solar!.day === 1 && solar!.month === 0) fest('Pana Sankranti (Odia New Year)', 'ପଣା ସଂକ୍ରାନ୍ତି');
      if (solar!.day === 1 && solar!.month === 9) fest('Makar Sankranti', 'ମକର ସଂକ୍ରାନ୍ତି');
      break;
    case 'punjabi':
      years.push({ en: `Bikrami ${vikram}`, native: `ਬਿਕ੍ਰਮੀ ${vikram}` });
      if (solar!.day === 1) fest(`Sangrand (${cal.solar!.months[solar!.month]} begins)`, `ਸੰਗਰਾਂਦ (${cal.solar!.native[solar!.month]})`);
      if (solar!.day === 1 && solar!.month === 0) fest('Vaisakhi', 'ਵਿਸਾਖੀ');
      if (solar!.day === 1 && solar!.month === 9) fest('Maghi', 'ਮਾਘੀ');
      break;
    case 'nepali': {
      const bs = afterBaisakh(y, m, solar!.month) ? y + 57 : y + 56;
      years.push({ en: `Bikram Sambat ${bs}`, native: `विक्रम संवत् ${toDevaDigits(bs)}` });
      if (solar!.day === 1 && solar!.month === 0) fest('Nepali New Year (Navavarsha)', 'नयाँ वर्ष');
      if (solar!.day === 1 && solar!.month === 9) fest('Maghe Sankranti', 'माघे संक्रान्ति');
      break;
    }
  }
  return { cal, date, lunar: cal.solar ? lunar : undefined, years, festivals };
}

/** True once the solar new year (Mesha / Baisakh 1) of this Gregorian year has begun. */
function afterBaisakh(y: number, m: number, solarMonth: number): boolean {
  // Mesha begins mid-April. From then to December the solar month index is 0–8; Jan–mid April it is 9–11.
  return m >= 4 && solarMonth <= 8;
}
/** Thiruvalluvar year = Gregorian + 31, changing on Thai 1 (mid-January). */
function tvYear(y: number, m: number, solarMonth: number) { return m === 1 && solarMonth === 8 ? y + 30 : y + 31; }
function solarYearSamvatsara(date: string, solarMonth: number) {
  const y = +date.slice(0, 4), m = +date.slice(5, 7);
  const startYear = afterBaisakh(y, m, solarMonth) ? y : y - 1;      // Gregorian year in which this Tamil year began
  return (((startYear - 1987) % 60) + 60) % 60;                       // 1987–88 = Prabhava
}
const toBengaliDigits = (n: number) => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[+d]);
const toDevaDigits = (n: number) => String(n).replace(/\d/g, d => '०१२३४५६७८९'[+d]);

import { describe, expect, it } from 'vitest';
import {
  DUBROVNIK_DICTIONARY,
  STANDARD_TO_DUBROVNIK_MAP,
} from '../../src/core/dubrovnik/dubrovnikDictionary';
import {
  contractDiphthongs,
  insertEpentheticJ,
  replaceHvWithF,
  shiftFinalMtoN,
  simplifyDentalClusters,
  enforceMaleNameDeclensions,
  applyThirdPersonPlural,
  transformToDubrovnikDialect,
  prepareDubrovnikTtsText,
} from '../../src/core/dubrovnik/dubrovnikPhonetics';
import {
  buildDubrovnikAgentInstructions,
  buildPersonaResearchSystemPrompt,
  doctorDialogueBlock,
  generateNextSceneBeats,
  adaptBlockBilingually,
} from '../../src/services/geminiAgentService';
import { Speaker, ScriptBlock } from '../../src/types/storia';

const createMockSpeaker = (overrides?: Partial<Speaker>): Speaker => ({
  id: 'spk_maro',
  name: 'Maro',
  age: '42',
  gender: 'male',
  personaPrompt: 'Dubrovački kapetan i trgovac',
  actingNotes: 'Samouvjereno i odmjereno',
  color: '#6366f1',
  createdAt: Date.now(),
  voice: {
    baseVoice: 'Puck',
    stylePrompt: 'Dubrovački pomorac',
    speakingRate: 1.0,
    pitchAdjustment: 0,
    enableDirectorNotes: true,
    ssmlEnabled: false,
    acoustics: {},
  },
  ...overrides,
});

describe('Dubrovnik Vernacular (Raguzejski idiom) Extension', () => {
  it('contains comprehensive authentic Dubrovnik vocabulary mappings', () => {
    expect(STANDARD_TO_DUBROVNIK_MAP.get('vilica')).toBe('pantaruo');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('žlica')).toBe('ožica');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('tanjur')).toBe('pjat');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('rajčica')).toBe('pomadora');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('krumpir')).toBe('patata');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('lubenica')).toBe('dinja');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('dinja')).toBe('pipun');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('hlače')).toBe('gaće');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('prozor')).toBe('funjestra');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('zavjesa')).toBe('koltrina');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('gospodin')).toBe('gospar');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('šutjeti')).toBe('mučat');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('ići')).toBe('hodit');
    expect(STANDARD_TO_DUBROVNIK_MAP.get('hvala')).toBe('fála');
    expect(DUBROVNIK_DICTIONARY.length).toBeGreaterThan(60);
  });

  it('performs accurate phonological contractions and epenthetic insertions', () => {
    // Diphthong contraction: -ao -> -ō
    expect(contractDiphthongs('rekao sam i poslao pismo')).toBe('rekō sam i poslō pismo');

    // Epenthetic j: -io -> -ijo
    expect(insertEpentheticJ('bio sam tamo i vidio sve')).toBe('bijo sam tamo i vidijo sve');
    expect(insertEpentheticJ('mislio je da je radio')).toBe('mislijo je da je radio');

    // /hv/ -> /f/
    expect(replaceHvWithF('hvala vam lijepa, pohvalite ga')).toBe('fála vam lijepa, pofalite ga');

    // Final -m -> -n
    expect(shiftFinalMtoN('vidio sam joj ruku')).toBe('vidio san jon ruku');

    // Dental cluster reduction
    expect(simplifyDentalClusters('čist zrak i teška bolest')).toBe('čis zrak i teška boles');
  });

  it('enforces strict masculine a-declension and -ov possessives for names on -o', () => {
    // Dative: Mari -> Maru, Đuri -> Đuru
    const fixedDative = enforceMaleNameDeclensions('rekao sam Mari i Đuri');
    expect(fixedDative).toBe('rekao sam Maru i Đuru');

    // Possessive: Matin -> Matov, Đurin -> Đurov
    const fixedPossessive = enforceMaleNameDeclensions('Matin brat i Đurina kuća');
    expect(fixedPossessive).toBe('Matov brat i Đurova kuća');
  });

  it('transforms 3rd person plural verbs from -e to -u', () => {
    const res = applyThirdPersonPlural('oni govore, oni vide i misle što čine');
    expect(res).toBe('oni govoru, oni vidu i mislu što činu');
  });

  it('transforms full conversational sentences into authentic Dubrovnik vernacular dialogue', () => {
    const raw = 'Bio sam u trgovini i kupio rajčice i krumpir. Hvala lijepa, doviđenja!';
    const transformed = transformToDubrovnikDialect(raw, 'contemporary');

    expect(transformed.toLowerCase()).toContain('bijo');
    expect(transformed.toLowerCase()).toContain('san');
    expect(transformed.toLowerCase()).toContain('butigi');
    expect(transformed.toLowerCase()).toContain('pomadore');
    expect(transformed.toLowerCase()).toContain('patata');
    expect(transformed.toLowerCase()).toContain('fála');
    expect(transformed.toLowerCase()).toContain('adio');
  });

  it('supports classical Držić/Gundulić register archaisms', () => {
    const raw = 'Uistinu imam svoje mišljenje.';
    const classical = transformToDubrovnikDialect(raw, 'classical');
    expect(classical).toContain('čertamente');
    expect(classical).toContain('parer');
  });

  it('prepares text phonetically for TTS engines with theatrical breath pauses', () => {
    const ttsInput = 'Mare, bona, muči, gospar Vlaho je rekō da stiže.';
    const prepared = prepareDubrovnikTtsText(ttsInput);

    expect(prepared).not.toContain('ō'); // Contracted vowel normalized to clean spoken o
    expect(prepared).toContain('Mare, ...');
    expect(prepared).toContain('muči, ...');
  });

  it('injects Dubrovnik dialect system instructions into Gemini AI agents', () => {
    const instructions = buildDubrovnikAgentInstructions('traditional');
    expect(instructions).toContain('DUBROVAČKI GOVOR');
    expect(instructions).toContain('ISKLJUČIVO (i)jekavski');
    expect(instructions).toContain('a-deklinaciji');
    expect(instructions).toContain('pantaruo');
    expect(instructions).toContain('TRADICIONALNI PUČKI GOVOR GRADA');

    const testSpeaker = createMockSpeaker();

    const personaPrompt = buildPersonaResearchSystemPrompt(
      testSpeaker,
      'hr',
      'dubrovnik',
      'traditional'
    );
    expect(personaPrompt).toContain('DUBROVAČKI GOVOR');
  });

  it('generates Dubrovnik dialect alternatives in Script Doctor and Co-Writer fallbacks', async () => {
    const block: ScriptBlock = {
      id: 'blk_test',
      type: 'dialogue',
      text: 'Bio sam u gradu i vidio sam prijatelje.',
      order: 0,
    };

    const doctorOptions = await doctorDialogueBlock({
      block,
      language: 'hr',
      dialect: 'dubrovnik',
    });

    expect(doctorOptions.length).toBeGreaterThanOrEqual(1);
    expect(doctorOptions[0].styleLabel).toContain('Dubrovački');
    expect(doctorOptions[0].text).toContain('san');

    const testSpeaker = createMockSpeaker({
      id: 'spk_1',
      name: 'Gospar Frano',
      age: '50',
      personaPrompt: 'Plemić Dubrovačke Republike',
      actingNotes: 'Otmjeno',
    });

    const coWriterBeats = await generateNextSceneBeats({
      precedingBlocks: [block],
      speakers: [testSpeaker],
      language: 'hr',
      dialect: 'dubrovnik',
    });

    expect(coWriterBeats.length).toBeGreaterThanOrEqual(1);

    const adapted = await adaptBlockBilingually({
      block: {
        ...block,
        text: 'I told you already, turn off the light.',
      },
      sourceLang: 'en',
      targetLang: 'hr',
      dialect: 'dubrovnik',
    });

    expect(adapted.culturalNotes).toContain('dubrovačkom govoru');
  });
});

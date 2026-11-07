import { DubrovnikRegister, GeminiTextModelId } from '../../types/storia';

/**
 * Builds the official Dubrovnik Vernacular (Raguzejski idiom) linguistic guidance prompt
 * based on the Dubrovnik Agent Dialect Specification.
 */
export function buildDubrovnikAgentInstructions(
  register: DubrovnikRegister = 'contemporary'
): string {
  return [
    'UPUTE ZA DUBROVAČKI GOVOR (RAGUZEJSKI IDIOM / GRADSKA ŠTOKAVŠTINA):',
    '1. Identitet i dijalekt: Generiraj autentične dijaloge na dubrovačkom govoru. Riječ je o jekavskom štokavskom idiomu prožetom specifičnom romanskom i povijesnom baštinom.',
    '2. Refleks jata: ISKLJUČIVO (i)jekavski (mlijeko, brijeme, dijete, svijet, snijeg). Nikada ne pretvaraj govor u čakavsku ili splitsku ikavicu!',
    '3. Zamjenice: Isključivo "što" (nikada "šta" u nominativu; genitiv "šta / od šta"). NIKADA "ča" ili "ćaća" (Dubrovčani kažu tata, otac ili ćaćko)!',
    '4. Sažimanja: Diftong -ao i -uo prelazi u dugo -ō (rekō, gledō, poslō, umbô). "Bio" -> "bijo", "vidio" -> "vidijo", "mjerio" -> "mírijo".',
    '5. Suglasnici: Završno -m prelazi u -n ("znala san", "s drugōn robōn", "jon"). /hv/ -> /f/ ("fála", "fálit"). Ispadanje zubnih okluziva ("bôles", "čis", "dësē", "mâs").',
    '6. Muška imena na -o: Sklanjaj ISKLJUČIVO po a-deklinaciji (Vlaho, Maro, Baldo, Đuro, Niko, Luko -> G: Vlaha, Mara, Balda; D/L: Vlahu, Maru; A: Vlaha, Mara). NIKADA "Mari", "Đuri", "Vlahi"!',
    '7. Posvojni pridjevi muških imena: Nastavak -ov (Matov, Đurov, Vlahov, Nikov - NIKADA Matin, Đurin)!',
    '8. Dativ i lokativ ž.r.: Nastavak -om ("po njegovom smrti", "mojom kćeri", enklitika "jon").',
    '9. 3. lice množine prezenta: Nastavak -u (oni govoru, vidu, stoju, činu, živu, mislu, nosu, dadu, znadu, imadu).',
    '10. Rječnik: Koristi autentične izraze: pantaruo (vilica), ožica (žlica), pjat (tanjur), teća (lonac), prosuja (tava), broka (vrč), kadin (lavor), pilo (sudoper), šugaman (ručnik), kušin (jastuk), funjestra (prozor), koltrina (zavjesa), patata (krumpir), pomadora (rajčica), dinja (lubenica!), pipun (dinja!), cukar (šećer), beškotin (keks/dvopek), butiga (dućan), placa (tržnica/Stradun), saket (vrećica), skalin (stepenica), gaće (duge hlače!), bječve (čarape), crevlje (cipele), vestit (odijelo), takujin (novčanik), lapis (olovka), čeljad (ljudi), našjenac (domaći), furesti (stranci), kučak (pas), manjgura (cura), gospar (gospodin/vlastelin), sinjora (gospođa), mučat (šutjeti), hodit (ići), pasat (proći), fermat (stati), arivat (stići), guštat (uživati), škerac (šala), drito (ravno), šesan (skladan/lijep), sikur (siguran), zdenjoz (ponosan/otresit), kontent (zadovoljan).',
    register === 'classical'
      ? '11. Registar: RENESANSNO-BAROKNI (16.-18. st. - Držić, Gundulić): Koristi aorist/imperfekt (rijeh, dah, pisah), "čertamente", "parer", "drago prolitje", "bivši moja volja".'
      : register === 'traditional'
        ? '11. Registar: TRADICIONALNI PUČKI GOVOR GRADA (kraj 19. i prva polovina 20. st.): Čistokrvni govor unutar zidina, perfekt/pluskvamperfekt ("bijo sam došō"), talijanizmi kućanstva i pomorstva.'
        : '11. Registar: SUVREMENI RAZGOVORNI DUBROVAČKI: Očuvana organska jezgra (patata, skalin, pantaruo, pomadora, gaće, čeljad, butiga), zatvoreni vokali, jekavizam i dubrovački ton.',
  ].join('\n');
}

/**
 * Builds the Gemini Generative Language REST API endpoint URL for `generateContent`.
 */
export function buildGeminiEndpoint(modelId: GeminiTextModelId, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId
  )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
}

/**
 * Strips optional ```json ... ``` markdown code fences from raw model text responses.
 */
export function stripMarkdownJsonFence(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  return cleaned;
}


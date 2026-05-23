import type { IRemoteBibleSource } from "../repositories/IBibleRepository";
import type { LocalJsonBibleRepository } from "../repositories/LocalJsonBibleRepository";
import { VerseRefCache } from "../cache/VerseRefCache";
import type { Lang, Mood, Verse } from "../domain/types";

const MAX_ATTEMPTS = 45;

type Source =
  | { kind: "remote"; idx: number }
  | { kind: "local" };

function shuffleSources(
  remotes: IRemoteBibleSource[],
  lang: Lang,
): Source[] {
  const sources: Source[] = [];
  for (let i = 0; i < remotes.length; i++) {
    if (remotes[i].supportsLanguage(lang)) {
      sources.push({ kind: "remote", idx: i });
    }
  }
  sources.push({ kind: "local" });
  for (let i = sources.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sources[i], sources[j]] = [sources[j], sources[i]];
  }
  return sources;
}

export class VerseService {
  constructor(
    private readonly local: LocalJsonBibleRepository,
    private readonly remotes: IRemoteBibleSource[],
    private readonly cache: VerseRefCache
  ) {}

  async getNextVerse(lang: Lang, mood: Mood): Promise<Verse> {
    const sources = shuffleSources(this.remotes, lang);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const avoid = this.cache.asSet();

      for (const src of sources) {
        if (src.kind === "remote") {
          const fromRemote = await this.remotes[src.idx].fetchVerse(
            lang,
            mood,
            avoid,
          );
          if (fromRemote && !avoid.has(fromRemote.ref)) {
            this.cache.rememberRef(fromRemote.ref);
            return fromRemote;
          }
        } else {
          const fromLocal = this.local.getRandomFromLocal(lang, mood, avoid);
          if (fromLocal && !avoid.has(fromLocal.ref)) {
            this.cache.rememberRef(fromLocal.ref);
            return fromLocal;
          }
          if (fromLocal) {
            this.cache.rememberRef(fromLocal.ref);
            return fromLocal;
          }
        }
      }
    }

    const last = this.local.getRandomFromLocal(lang, mood, new Set());
    if (last) {
      this.cache.rememberRef(last.ref);
      return last;
    }

    return {
      id: "fallback",
      text: "In the beginning God created the heaven and the earth.",
      ref: "Genesis 1:1",
      source: "local",
      categories: [],
      language: "en",
    };
  }
}

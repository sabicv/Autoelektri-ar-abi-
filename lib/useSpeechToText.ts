'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// Minimal shape of the Web Speech API we actually use — not part of
// lib.dom.d.ts, and support varies (Chrome/Edge/Safari; no Firefox), so
// this is feature-detected and typed just enough to avoid `any` leaking
// through consumers.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface UseSpeechToTextOptions {
  onFinalText?: (text: string) => void;
}

const ERROR_MESSAGES_HR: Record<string, string> = {
  'not-allowed': 'Mikrofon nije dozvoljen. Dodirnite ikonu lokota pored adrese stranice i dozvolite mikrofon.',
  'service-not-allowed': 'Mikrofon nije dozvoljen. Dodirnite ikonu lokota pored adrese stranice i dozvolite mikrofon.',
  'audio-capture': 'Mikrofon nije pronađen ili ga koristi druga aplikacija.',
  network: 'Prepoznavanje govora treba internetsku vezu.',
  'no-speech': 'Nisam čuo govor — dodirnite Diktiraj i pričajte odmah.',
};

export function useSpeechToText({ onFinalText }: UseSpeechToTextOptions = {}) {
  const [isSupported, setIsSupported] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalTextRef = useRef(onFinalText);
  onFinalTextRef.current = onFinalText;
  // Whether the mic should keep listening after the current utterance ends —
  // a ref so onend (fired by the browser) always reads the latest value.
  const keepGoingRef = useRef(false);
  const isMobileRef = useRef(false);
  // Android Chrome re-delivers finals: sometimes verbatim, sometimes as the
  // whole utterance so far ("prazan" → "prazan akumulator"). Only the part
  // not yet emitted is passed on, so text never doubles up.
  const lastFinalTranscriptRef = useRef('');
  // Did the current recognition session hear anything? Restarting after a
  // silent session is what made phones beep and buzz in a loop.
  const heardSpeechRef = useRef(false);
  const sessionHadSpeechRef = useRef(false);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!Ctor) {
      setIsSupported(false);
      return;
    }

    // Phone browsers end recognition on every pause and beep/vibrate on every
    // start. So: keep listening across pauses while the mechanic is talking,
    // but once a session ends having heard nothing, stop instead of looping.
    isMobileRef.current = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    const recognition = new Ctor();
    recognition.lang = 'hr-HR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      const finalChunks: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;
        heardSpeechRef.current = true;
        sessionHadSpeechRef.current = true;

        if (!result.isFinal) {
          interim += `${transcript} `;
          continue;
        }

        const previous = lastFinalTranscriptRef.current;
        const addition = previous && transcript.startsWith(previous) ? transcript.slice(previous.length).trim() : transcript;
        lastFinalTranscriptRef.current = transcript;
        if (addition && addition !== previous) finalChunks.push(addition);
      }
      if (finalChunks.length > 0) onFinalTextRef.current?.(finalChunks.join(' '));
      setInterimText(interim.trim());
    };

    recognition.onerror = (event) => {
      // Silence after the mechanic has already dictated is just "done".
      if (event.error === 'no-speech' && sessionHadSpeechRef.current) return;
      if (event.error === 'aborted') return;
      keepGoingRef.current = false;
      setIsRecording(false);
      const message = ERROR_MESSAGES_HR[event.error];
      if (message) toast.error(message);
    };

    recognition.onend = () => {
      setInterimText('');
      const shouldRestart = keepGoingRef.current && (!isMobileRef.current || heardSpeechRef.current);
      heardSpeechRef.current = false;
      if (shouldRestart) {
        try {
          recognition.start();
          return;
        } catch {
          // Fall through to stopping.
        }
      }
      keepGoingRef.current = false;
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      keepGoingRef.current = false;
      recognition.stop();
    };
  }, []);

  function toggleRecording() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isRecording) {
      keepGoingRef.current = false;
      recognition.stop();
      setIsRecording(false);
      return;
    }

    lastFinalTranscriptRef.current = '';
    heardSpeechRef.current = false;
    sessionHadSpeechRef.current = false;
    keepGoingRef.current = true;
    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      // start() throws if the previous session hasn't fully ended yet.
      keepGoingRef.current = false;
      toast.error('Mikrofon se još gasi — pokušajte ponovno za sekundu.');
    }
  }

  return { isSupported, isRecording, interimText, toggleRecording };
}

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
  // Guards against re-emitting a final result Chrome re-delivers verbatim
  // after one of its own internal restarts in continuous mode.
  const lastFinalTranscriptRef = useRef('');

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

    // Phone browsers play a system beep/vibration every time recognition
    // starts and end it on every pause, so an auto-restart loop there made the
    // phone buzz nonstop. On phones: one utterance per tap, no restart.
    // Desktop Chrome handles continuous listening fine.
    isMobileRef.current = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    const recognition = new Ctor();
    recognition.lang = 'hr-HR';
    recognition.continuous = !isMobileRef.current;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      const finalChunks: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript;
          if (transcript && transcript !== lastFinalTranscriptRef.current) {
            finalChunks.push(transcript);
            lastFinalTranscriptRef.current = transcript;
          }
        } else {
          interim += result[0].transcript;
        }
      }
      if (finalChunks.length > 0) onFinalTextRef.current?.(finalChunks.join(' '));
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      keepGoingRef.current = false;
      setIsRecording(false);
      const message = ERROR_MESSAGES_HR[event.error];
      if (message) toast.error(message);
    };

    recognition.onend = () => {
      setInterimText('');
      if (keepGoingRef.current && !isMobileRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          keepGoingRef.current = false;
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

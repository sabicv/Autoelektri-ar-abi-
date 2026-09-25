'use client';

import { useEffect, useRef, useState } from 'react';

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
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface UseSpeechToTextOptions {
  onFinalText?: (text: string) => void;
}

export function useSpeechToText({ onFinalText }: UseSpeechToTextOptions = {}) {
  const [isSupported, setIsSupported] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalTextRef = useRef(onFinalText);
  onFinalTextRef.current = onFinalText;
  // Whether the mic should keep listening after the current utterance ends —
  // separate from React state so onend (fired by the browser, not us) always
  // reads the latest value instead of a stale closure.
  const keepGoingRef = useRef(false);
  // Guards against re-emitting a final result Android Chrome re-delivers
  // verbatim after one of its own internal restarts (see continuous below).
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

    const recognition = new Ctor();
    recognition.lang = 'hr-HR';
    // continuous=true, kept listening across pauses instead of ending and
    // restarting recognition.start() per utterance (continuous=false) — that
    // restart cycle triggers Android's "mic listening" earcon/haptic on every
    // single pause during dictation, which felt like the phone endlessly
    // buzzing. continuous=true avoids that, at the cost of Android Chrome
    // occasionally re-delivering an already-finalized result verbatim after
    // one of its own internal restarts (sounded like dictation "repeating
    // words") — guarded below by skipping a final result identical to the
    // immediately preceding one.
    recognition.continuous = true;
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

    recognition.onerror = () => {
      keepGoingRef.current = false;
      setIsRecording(false);
    };

    recognition.onend = () => {
      setInterimText('');
      if (keepGoingRef.current) {
        try {
          recognition.start();
        } catch {
          keepGoingRef.current = false;
          setIsRecording(false);
        }
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      keepGoingRef.current = false;
      recognition.stop();
    };
  }, []);

  function toggleRecording() {
    if (!recognitionRef.current) return;
    if (isRecording) {
      keepGoingRef.current = false;
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      lastFinalTranscriptRef.current = '';
      keepGoingRef.current = true;
      recognitionRef.current.start();
      setIsRecording(true);
    }
  }

  return { isSupported, isRecording, interimText, toggleRecording };
}

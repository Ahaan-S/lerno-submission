"use client";

import { useCallback, useState } from "react";

export interface MicDevice {
  deviceId: string;
  label: string;
}

export function useMicDevices() {
  const [devices, setDevices] = useState<MicDevice[]>([]);

  const enumerate = useCallback(async () => {
    try {
      // Trigger permission prompt so device labels are populated.
      await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((s) => s.getTracks().forEach((t) => t.stop()))
        .catch(() => {});

      const all = await navigator.mediaDevices.enumerateDevices();
      const mics = all
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
        }));
      setDevices(mics);
    } catch {
      setDevices([]);
    }
  }, []);

  return { devices, enumerate };
}

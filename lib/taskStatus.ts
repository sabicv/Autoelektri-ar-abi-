'use client';

import type { MechanicTask, TaskStatus } from '@/types/database';

// Returns the saved task, or null when the server didn't store the change.
export async function updateTaskStatus(taskId: string, status: Exclude<TaskStatus, 'PENDING'>): Promise<MechanicTask | null> {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json.task ?? null;
  } catch {
    return null;
  }
}

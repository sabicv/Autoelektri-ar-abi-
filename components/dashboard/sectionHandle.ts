// Job detail sections save through one shared "Spremi promjene" button, so
// each editor exposes this instead of rendering its own save button.
export interface SectionHandle {
  isDirty: () => boolean;
  // Resolves false on failure (the section shows its own error toast).
  save: () => Promise<boolean>;
}

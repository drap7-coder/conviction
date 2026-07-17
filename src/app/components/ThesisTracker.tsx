"use client";

import { useState, useRef, useEffect } from "react";
import type { ThesisStatus, WatchlistThesis } from "@/lib/watchlist/types";

interface ThesisTrackerProps {
  ticker: string;
  companyName: string;
  thesis?: WatchlistThesis;
  onSave: (thesis: WatchlistThesis) => Promise<{ success: boolean; error?: string }>;
}

const THESIS_LENGTH_LIMIT = 1000;

const STATUS_LABELS: Record<ThesisStatus, string> = {
  building: "Building",
  supported: "Supported",
  review: "Review",
  weakening: "Weakening",
  broken: "Broken",
};

export function ThesisTracker({ ticker, companyName, thesis, onSave }: ThesisTrackerProps) {
  const [localThesis, setLocalThesis] = useState<WatchlistThesis>(
    thesis ?? {
      thesis: "",
      invalidation: "",
      reviewAt: null,
      status: "building",
    },
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [originalThesis, setOriginalThesis] = useState<WatchlistThesis | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync local state when thesis prop changes
  useEffect(() => {
    if (thesis) {
      setLocalThesis(thesis);
    }
  }, [thesis]);

  const startEdit = () => {
    setOriginalThesis(localThesis);
    setIsEditing(true);
    setHasUnsavedChanges(false);
    setSaveError(null);
  };

  const cancelEdit = () => {
    if (originalThesis) {
      setLocalThesis(originalThesis);
      setOriginalThesis(null);
    }
    setIsEditing(false);
    setHasUnsavedChanges(false);
    setSaveError(null);
  };

  const handleFieldChange = (field: keyof WatchlistThesis, value: string) => {
    const newThesis = { ...localThesis, [field]: value };
    setLocalThesis(newThesis);
    setHasUnsavedChanges(true);
  };

  const handleStatusChange = (status: ThesisStatus) => {
    const newThesis = { ...localThesis, status };
    setLocalThesis(newThesis);
    setHasUnsavedChanges(true);
  };

  const handleReviewDateChange = (value: string) => {
    handleFieldChange("reviewAt", value);
  };

  const truncateText = (text: string, max: number): string => {
    if (text.length <= max) return text;
    return text.slice(0, max);
  };

  const handleSave = async () => {
    if (isSaving) return;

    // Validate
    if (localThesis.thesis.length > THESIS_LENGTH_LIMIT) {
      setSaveError(`Thesis must be ${THESIS_LENGTH_LIMIT} characters or less`);
      return;
    }
    if (localThesis.invalidation.length > THESIS_LENGTH_LIMIT) {
      setSaveError(`Invalidation must be ${THESIS_LENGTH_LIMIT} characters or less`);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Cancel any pending requests
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const result = await onSave({
        thesis: truncateText(localThesis.thesis, THESIS_LENGTH_LIMIT),
        invalidation: truncateText(localThesis.invalidation, THESIS_LENGTH_LIMIT),
        reviewAt: localThesis.reviewAt,
        status: localThesis.status,
      });

      if (result.success) {
        setIsEditing(false);
        setHasUnsavedChanges(false);
        setOriginalThesis(null);
      } else {
        setSaveError(result.error ?? "Save failed");
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const displayThesis = localThesis.thesis || "No thesis recorded";
  const displayInvalidation = localThesis.invalidation || "No invalidation criteria";

  return (
    <div className="thesis-tracker-panel">
      <div className="section-header">
        <h2 className="section-title">Thesis</h2>
        <span className="section-count">{STATUS_LABELS[localThesis.status]}</span>
      </div>

      {!isEditing && (
        <div className="thesis-display">
          <div className="thesis-field">
            <strong>Thesis:</strong> {displayThesis}
          </div>
          <div className="thesis-field">
            <strong>What would invalidate it?</strong> {displayInvalidation}
          </div>
          {localThesis.reviewAt && (
            <div className="thesis-field">
              <strong>Review by:</strong> {new Date(localThesis.reviewAt).toLocaleDateString()}
            </div>
          )}
          <button
            onClick={startEdit}
            className="thesis-edit-button"
            aria-label="Edit thesis"
          >
            Edit
          </button>
        </div>
      )}

      {isEditing && (
        <div className="thesis-edit-form">
          <div className="thesis-form-group">
            <label htmlFor={`thesis-${ticker}`}>Thesis</label>
            <textarea
              id={`thesis-${ticker}`}
              value={localThesis.thesis}
              onChange={(e) => handleFieldChange("thesis", e.target.value)}
              rows={3}
              maxLength={THESIS_LENGTH_LIMIT}
              placeholder="Describe your investment thesis..."
            />
            <div className="thesis-counter">
              {localThesis.thesis.length}/{THESIS_LENGTH_LIMIT}
            </div>
          </div>

          <div className="thesis-form-group">
            <label htmlFor={`invalidation-${ticker}`}>What would invalidate it?</label>
            <textarea
              id={`invalidation-${ticker}`}
              value={localThesis.invalidation}
              onChange={(e) => handleFieldChange("invalidation", e.target.value)}
              rows={2}
              maxLength={THESIS_LENGTH_LIMIT}
              placeholder="What would cause you to exit this position?"
            />
            <div className="thesis-counter">
              {localThesis.invalidation.length}/{THESIS_LENGTH_LIMIT}
            </div>
          </div>

          <div className="thesis-form-group">
            <label htmlFor={`reviewAt-${ticker}`}>Review date</label>
            <input
              type="date"
              id={`reviewAt-${ticker}`}
              value={localThesis.reviewAt ?? ""}
              onChange={(e) => handleReviewDateChange(e.target.value)}
            />
          </div>

          <div className="thesis-form-group">
            <label>Status</label>
            <select
              value={localThesis.status}
              onChange={(e) => handleStatusChange(e.target.value as ThesisStatus)}
            >
              <option value="building">Building</option>
              <option value="supported">Supported</option>
              <option value="review">Review</option>
              <option value="weakening">Weakening</option>
              <option value="broken">Broken</option>
            </select>
          </div>

          {saveError && (
            <div className="thesis-error">{saveError}</div>
          )}

          <div className="thesis-actions">
            <button
              onClick={cancelEdit}
              disabled={isSaving}
              className="thesis-button thesis-button-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className={`thesis-button ${hasUnsavedChanges ? "thesis-button-primary" : "thesis-button-secondary"}`}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
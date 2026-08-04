import React, { useState } from "react";

const BREAK_TYPES = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH", label: "Lunch" },
  { value: "TEA", label: "Tea" },
  { value: "CLOTHES", label: "Clothes" },
  { value: "MORNING MEETING", label: "Morning Meeting" },
];

export const BreakForm = ({ initialData, onSuccess, onCancel }) => {
  const safeData = initialData || {};
  const [breakType, setBreakType] = useState(safeData.breakType || "");
  const [durationMinutes, setDurationMinutes] = useState(
    safeData.durationMinutes !== undefined && safeData.durationMinutes !== null
      ? String(safeData.durationMinutes)
      : ""
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!breakType) {
      return;
    }

    const duration = durationMinutes === "" ? null : Number(durationMinutes);
    if (duration === null || Number.isNaN(duration) || duration < 0) {
      // Keep validation lightweight; backend enforces too.
      return;
    }

    onSuccess({
      breakType,
      durationMinutes: duration,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Break Type</label>
        <select
          value={breakType}
          onChange={(e) => setBreakType(e.target.value)}
          required
          className="w-full border rounded px-2 py-1"
        >
          <option value="">Select break type</option>
          {BREAK_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
        <input
          type="number"
          min="0"
          step="1"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          required
          className="w-full border rounded px-2 py-1"
        />
      </div>
      <div className="flex space-x-2">
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Save
        </button>
        <button
          type="button"
          className="bg-gray-300 px-4 py-2 rounded"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

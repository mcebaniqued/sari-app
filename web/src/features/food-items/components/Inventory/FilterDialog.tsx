import { foodItemQuerySchema, foodUnitSchema } from "@sari/contracts";
import { useEffect, useRef, useState } from "react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import Modal from "@/components/Modal/Modal";
import { foodUnitLabels } from "../../utils/foodUnits";
import {
  appliedFilterEntries,
  dateConditions,
  expirationConditions,
  filterFields,
  type InventoryFilters,
  type LogicalFilterField,
  numericConditions,
} from "./filterModel";

interface Editor {
  id: number;
  started: boolean;
  field: LogicalFilterField | "";
  operator: string;
  value: string;
  to: string;
  unit: string;
  legacy: {
    label: string;
    description: string;
    filters: InventoryFilters;
  } | null;
}

type ValidationTarget = "field" | "operator" | "value" | "to" | "unit";

interface ValidationError {
  message: string;
  target: ValidationTarget;
}

const focusClass =
  "rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const controlClass =
  "mt-1 min-h-11 w-full min-w-0 rounded-control border bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2";

function emptyEditor(id: number): Editor {
  return {
    id,
    started: false,
    field: "",
    operator: "equals",
    value: "",
    to: "",
    unit: "",
    legacy: null,
  };
}

function initialEditors(filters: InventoryFilters): Editor[] {
  const entries = appliedFilterEntries(filters);
  return entries.length
    ? entries.map((entry, id) => {
        const editor = { ...emptyEditor(id), field: entry.field };
        if (!entry.editable) {
          return {
            ...editor,
            legacy: {
              label: entry.label,
              description: entry.description,
              filters: Object.fromEntries(
                entry.apiFields.map((field) => [field, filters[field]]),
              ),
            },
          };
        }

        if (entry.field === "amount") {
          return {
            ...editor,
            operator: filters.quantity?.type ?? "equals",
            value: String(filters.quantity?.filter ?? ""),
            to: String(filters.quantity?.filterTo ?? ""),
            unit: filters.unit?.filter ?? "",
          };
        }

        const date =
          entry.field === "expiresOn" ? filters.expiresOn : filters.createdAt;
        return {
          ...editor,
          operator: date?.type ?? "equals",
          value: date?.dateFrom?.slice(0, 10) ?? "",
          to: date?.dateTo?.slice(0, 10) ?? "",
        };
      })
    : [emptyEditor(0)];
}

function editorPredicates(
  editor: Editor,
):
  | { filters: InventoryFilters; error?: never }
  | { error: string; target: ValidationTarget; filters?: never } {
  if (editor.legacy) {
    return { filters: editor.legacy.filters };
  }
  if (!editor.field) {
    return { error: "Choose a field or remove this filter.", target: "field" };
  }

  const range = editor.operator === "inRange";
  const noValue = editor.operator === "blank" || editor.operator === "notBlank";
  if (!noValue && !editor.value.trim()) {
    return {
      target: "value",
      error:
        editor.field === "amount"
          ? range
            ? "Enter the From and To quantities."
            : "Enter a quantity."
          : range
            ? "Enter the From and To dates."
            : "Choose a date.",
    };
  }
  if (range && !editor.to.trim()) {
    return {
      target: "to",
      error:
        editor.field === "amount"
          ? "Enter a To quantity."
          : "Choose a To date.",
    };
  }
  if (
    editor.field === "amount" &&
    !foodUnitSchema.safeParse(editor.unit).success
  ) {
    return { error: "Choose a unit.", target: "unit" };
  }

  const raw =
    editor.field === "amount"
      ? {
          quantity: {
            filterType: "number",
            type: editor.operator,
            filter: Number(editor.value),
            ...(range ? { filterTo: Number(editor.to) } : {}),
          },
          unit: { filterType: "text", type: "equals", filter: editor.unit },
        }
      : {
          [editor.field]: {
            filterType: "date",
            type: editor.operator,
            ...(!noValue
              ? {
                  dateFrom: editor.value,
                  ...(range ? { dateTo: editor.to } : {}),
                }
              : {}),
          },
        };
  const parsed = foodItemQuerySchema.safeParse({ filters: raw });
  if (parsed.success) {
    return { filters: parsed.data.filters };
  }

  const issue = parsed.error.issues[0];
  const path = issue?.path.join(".") ?? "";
  const target: ValidationTarget =
    path.endsWith(".filterTo") || path.endsWith(".dateTo")
      ? "to"
      : path.endsWith(".filter") || path.endsWith(".dateFrom")
        ? "value"
        : path.endsWith(".type")
          ? "operator"
          : path.startsWith("filters.unit")
            ? "unit"
            : range
              ? "to"
              : "value";
  return { error: issue?.message ?? "Check the filter values.", target };
}

function editorIsUnused(editor: Editor) {
  return (
    !editor.legacy &&
    !editor.field &&
    !editor.value.trim() &&
    !editor.to.trim() &&
    !editor.unit
  );
}

interface FilterDialogProps {
  filters: InventoryFilters;
  focusField?: LogicalFilterField | undefined;
  onApply: (filters: InventoryFilters) => void;
  onClose: () => void;
  onRestoreFocusFallback?: () => void;
}

export default function FilterDialog({
  filters,
  focusField,
  onApply,
  onClose,
  onRestoreFocusFallback,
}: FilterDialogProps) {
  const [editors, setEditors] = useState(() => initialEditors(filters));
  const nextId = useRef(6);
  const editorRefs = useRef(new Map<number, HTMLFieldSetElement>());
  const pendingFocus = useRef<number | null>(null);
  const [errors, setErrors] = useState<Record<number, ValidationError>>({});

  useEffect(() => {
    if (pendingFocus.current !== null) {
      const card = editorRefs.current.get(pendingFocus.current);
      (
        card?.querySelector<HTMLElement>("select") ??
        card?.querySelector<HTMLElement>("button")
      )?.focus();
      pendingFocus.current = null;
    }
  }, [editors]);

  function update(id: number, change: Partial<Editor>) {
    const currentEditor = editors.find((editor) => editor.id === id);
    if (!currentEditor) return;

    const nextEditor = { ...currentEditor, ...change, started: true };
    setEditors((current) =>
      current.map((editor) =>
        editor.id === id ? nextEditor : editor,
      ),
    );
    setErrors((current) => {
      if (!current[id]) return current;

      if (editorIsUnused(nextEditor)) {
        const next = { ...current };
        delete next[id];
        return next;
      }

      const parsed = editorPredicates(nextEditor);
      const next = { ...current };
      if (parsed.error === undefined) {
        delete next[id];
      } else {
        next[id] = { message: parsed.error, target: parsed.target };
      }
      return next;
    });
  }

  function validateAfterLeaving(editor: Editor) {
    if (!editor.started || editorIsUnused(editor)) {
      setErrors((current) => {
        if (!current[editor.id]) return current;

        const next = { ...current };
        delete next[editor.id];
        return next;
      });
      return;
    }

    const parsed = editorPredicates(editor);
    setErrors((current) => {
      const next = { ...current };
      if (parsed.error === undefined) {
        delete next[editor.id];
      } else {
        next[editor.id] = {
          message: parsed.error,
          target: parsed.target,
        };
      }
      return next;
    });
  }

  function reset() {
    const editor = emptyEditor(nextId.current++);
    pendingFocus.current = editor.id;
    setEditors([editor]);
    setErrors({});
  }

  function remove(id: number) {
    const index = editors.findIndex((editor) => editor.id === id);
    const remaining = editors.filter((editor) => editor.id !== id);
    const next = remaining.length ? remaining : [emptyEditor(nextId.current++)];
    pendingFocus.current = next[Math.min(index, next.length - 1)]?.id ?? null;
    setEditors(next);
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[id];
      return nextErrors;
    });
  }

  function apply() {
    const applied: InventoryFilters = {};
    const nextErrors: Record<number, ValidationError> = {};
    for (const editor of editors) {
      if (editorIsUnused(editor)) continue;

      const parsed = editorPredicates(editor);
      if (parsed.error !== undefined) {
        nextErrors[editor.id] = {
          message: parsed.error,
          target: parsed.target,
        };
      } else {
        Object.assign(applied, parsed.filters);
      }
    }
    const firstInvalid = editors.find((editor) => nextErrors[editor.id]);
    if (firstInvalid) {
      setErrors(nextErrors);
      const target = nextErrors[firstInvalid.id]?.target;
      editorRefs.current
        .get(firstInvalid.id)
        ?.querySelector<HTMLElement>(`[data-filter-control="${target}"]`)
        ?.focus();
      return;
    }
    setErrors({});
    onApply(applied);
  }

  const available = filterFields.filter(
    (field) =>
      !editors.some(
        (editor) =>
          editor.field === field.id ||
          (field.id === "amount" &&
            (editor.field === "quantity" || editor.field === "unit")),
      ),
  );
  const emptyEditorCount = editors.filter(
    (editor) => !editor.legacy && !editor.field,
  ).length;
  const canAdd = available.length > emptyEditorCount;

  return (
    <Modal
      title="Filter items"
      onClose={onClose}
      onRestoreFocusFallback={onRestoreFocusFallback}
      scroll="contained"
    >
      <div
        data-filter-dialog-content
        className="h-[min(27rem,calc(100dvh-12.5rem))] shrink-0 space-y-4 overflow-y-auto overscroll-contain px-6 py-5"
      >
        {editors.map((editor, index) => {
          const label =
            editor.legacy?.label ??
            filterFields.find((field) => field.id === editor.field)?.label;
          const range = editor.operator === "inRange";
          const noValue =
            editor.operator === "blank" || editor.operator === "notBlank";
          const conditions =
            editor.field === "amount"
              ? numericConditions
              : editor.field === "expiresOn"
                ? expirationConditions
                : dateConditions;
          const autofocus = focusField
            ? editor.field === focusField
            : index === 0;
          const error = errors[editor.id];
          const invalid = (target: ValidationTarget) =>
            error?.target === target;
          const describedBy = (target: ValidationTarget) =>
            invalid(target) ? `filter-error-${editor.id}` : undefined;
          const controlStateClass = (target: ValidationTarget) =>
            invalid(target)
              ? "border-danger focus-visible:outline-danger"
              : "border-border-control focus-visible:outline-brand";
          const input = (inputLabel: string, key: "value" | "to") => (
            <label className="block min-w-0 text-sm font-medium">
              {inputLabel}
              <input
                type={editor.field === "amount" ? "number" : "date"}
                step={editor.field === "amount" ? "any" : undefined}
                value={editor[key]}
                data-filter-control={key}
                aria-invalid={invalid(key) || undefined}
                aria-describedby={describedBy(key)}
                onChange={(event) => {
                  update(editor.id, { [key]: event.target.value });
                }}
                className={`${controlClass} ${controlStateClass(key)}`}
              />
            </label>
          );

          return (
            <fieldset
              key={editor.id}
              ref={(element) => {
                if (element) {
                  editorRefs.current.set(editor.id, element);
                } else {
                  editorRefs.current.delete(editor.id);
                }
              }}
              onBlur={(event) => {
                if (
                  event.relatedTarget instanceof Node &&
                  event.currentTarget.contains(event.relatedTarget)
                ) {
                  return;
                }
                validateAfterLeaving(editor);
              }}
              className="@container space-y-3 border-t border-border-default py-4 first:border-t-0 first:pt-0 last:pb-0"
            >
              <legend className="sr-only">Filter {index + 1}</legend>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  Filter {index + 1}
                  {label ? ` — ${label}` : ""}
                </span>
                {(editor.field || editors.length > 1) && (
                  <button
                    type="button"
                    aria-label={
                      label
                        ? `Remove ${label} filter`
                        : `Remove empty filter ${index + 1}`
                    }
                    onClick={() => {
                      remove(editor.id);
                    }}
                    className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-danger ${focusClass}`}
                  >
                    <LuTrash2 aria-hidden="true" />
                  </button>
                )}
              </div>
              {editor.legacy ? (
                <div
                  tabIndex={-1}
                  data-autofocus={autofocus || undefined}
                  className={`space-y-2 text-sm ${focusClass}`}
                >
                  <p>{editor.legacy.description}</p>
                  <p className="text-content-muted">
                    This existing filter cannot be edited with these controls.
                    It stays applied until you remove it or reset the filters.
                  </p>
                </div>
              ) : (
                <>
                  <label className="block text-sm font-medium">
                    Filter by
                    <select
                      data-autofocus={autofocus || undefined}
                      data-filter-control="field"
                      value={editor.field}
                      aria-invalid={invalid("field") || undefined}
                      aria-describedby={describedBy("field")}
                      onChange={(event) => {
                        const field = filterFields.find(
                          (candidate) => candidate.id === event.target.value,
                        );
                        update(editor.id, {
                          field: field?.id ?? "",
                          operator: "equals",
                          value: "",
                          to: "",
                          unit: "",
                        });
                      }}
                      className={`${controlClass} ${controlStateClass("field")}`}
                    >
                      <option value="">Choose a field</option>
                      {filterFields
                        .filter(
                          (field) =>
                            field.id === editor.field ||
                            available.some(
                              (candidate) => candidate.id === field.id,
                            ),
                        )
                        .map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  {editor.field && (
                    <>
                      <label className="block text-sm font-medium">
                        Condition
                        <select
                          data-filter-control="operator"
                          value={editor.operator}
                          aria-invalid={invalid("operator") || undefined}
                          aria-describedby={describedBy("operator")}
                          onChange={(event) => {
                            const operator = event.target.value;
                            update(editor.id, {
                              operator,
                              value:
                                operator === "blank" || operator === "notBlank"
                                  ? ""
                                  : editor.value,
                              to: operator === "inRange" ? editor.to : "",
                            });
                          }}
                          className={`${controlClass} ${controlStateClass("operator")}`}
                        >
                          {conditions.map((condition) => (
                            <option
                              key={condition.value}
                              value={condition.value}
                            >
                              {condition.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!noValue && (
                        <div
                          className={
                            editor.field === "amount" || range
                              ? "grid grid-cols-1 gap-3 @min-[16rem]:grid-cols-2"
                              : ""
                          }
                        >
                          {input(
                            range
                              ? "From"
                              : editor.field === "amount"
                                ? "Quantity"
                                : "Date",
                            "value",
                          )}
                          {range && input("To", "to")}
                          {editor.field === "amount" && (
                            <label
                              className={`block min-w-0 text-sm font-medium ${range ? "col-span-full" : ""}`}
                            >
                              Unit
                              <select
                                data-filter-control="unit"
                                value={editor.unit}
                                aria-invalid={invalid("unit") || undefined}
                                aria-describedby={describedBy("unit")}
                                onChange={(event) => {
                                  update(editor.id, {
                                    unit: event.target.value,
                                  });
                                }}
                                className={`${controlClass} ${controlStateClass("unit")}`}
                              >
                                <option value="">Choose a unit</option>
                                {foodUnitSchema.options.map((unit) => (
                                  <option key={unit} value={unit}>
                                    {foodUnitLabels[unit]}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              {error && (
                <p
                  id={`filter-error-${editor.id}`}
                  role="alert"
                  className="text-sm text-danger"
                >
                  {error.message}
                </p>
              )}
            </fieldset>
          );
        })}
        {canAdd && (
          <button
            type="button"
            onClick={() => {
              const editor = emptyEditor(nextId.current++);
              pendingFocus.current = editor.id;
              setEditors((current) => [...current, editor]);
            }}
            className={`inline-flex min-h-11 items-center gap-2 text-sm font-medium ${focusClass}`}
          >
            <LuPlus aria-hidden="true" /> Add another filter
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 border-t border-border-default px-6 py-4">
        <button
          type="button"
          onClick={reset}
          className={`mr-auto min-h-11 px-3 text-sm underline ${focusClass}`}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`min-h-11 border border-border-default px-3 text-sm ${focusClass}`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={apply}
          className={`min-h-11 bg-brand px-4 text-sm font-semibold text-content-inverse ${focusClass}`}
        >
          Apply
        </button>
      </div>
    </Modal>
  );
}

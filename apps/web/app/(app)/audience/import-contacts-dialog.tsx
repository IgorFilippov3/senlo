"use client";

import React, { useState, useRef } from "react";
import {
  Dialog,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@senlo/ui";
import { Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
import Papa, { ParseResult } from "papaparse";
import { useImportContacts } from "apps/web/queries/audience";
import { RecipientList } from "@senlo/core";

interface ImportContactsDialogProps {
  projectId: number;
  lists: RecipientList[];
}

type Step = "upload" | "mapping" | "target" | "processing" | "complete";

type TargetList = "none" | "new" | number;

type ColumnMapping = {
  email: string;
  name: string;
};

type ImportResult = {
  total: number;
  newCount: number;
  updatedCount: number;
  listId?: number;
};

export function ImportContactsDialog({
  projectId,
  lists,
}: ImportContactsDialogProps) {
  const { mutate: importContacts } = useImportContacts();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    email: "",
    name: "",
  });
  const [targetList, setTargetList] = useState<TargetList>("none");
  const [newListName, setNewListName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setPreviewRows([]);
    setMapping({ email: "", name: "" });
    setTargetList("none");
    setNewListName("");
    setIsImporting(false);
    setResult(null);
    setError(null);
  };

  const handleTargetListChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    setTargetList(e.target.value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (selectedFile.size > maxSize) {
      setError("File size must be less than 5MB");
      return;
    }

    Papa.parse(selectedFile, {
      header: false,
      skipEmptyLines: true,
      complete: (results: ParseResult<string[]>) => {
        const rows = results.data;
        if (rows.length === 0) {
          setError("File is empty");
          return;
        }

        const fileHeaders = rows[0];
        setHeaders(fileHeaders);
        setPreviewRows(rows.slice(1, 6)); // Preview first 5 rows
        setFile(selectedFile);
        setStep("mapping");

        // Auto-mapping
        const emailIdx = fileHeaders.findIndex((h) =>
          h.toLowerCase().includes("email"),
        );
        const nameIdx = fileHeaders.findIndex(
          (h) =>
            h.toLowerCase().includes("name") ||
            h.toLowerCase().includes("full name"),
        );

        setMapping({
          email: emailIdx !== -1 ? fileHeaders[emailIdx] : "",
          name: nameIdx !== -1 ? fileHeaders[nameIdx] : "",
        });
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`);
      },
    });
  };

  const startImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setStep("processing");

    try {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as string[][];
          const headers = rows[0];
          const dataRows = rows.slice(1);

          const emailIdx = headers.indexOf(mapping.email);
          const nameIdx = mapping.name ? headers.indexOf(mapping.name) : -1;

          const contactsToImport = dataRows
            .map((row) => ({
              email: row[emailIdx],
              name: nameIdx !== -1 ? row[nameIdx] : undefined,
            }))
            .filter((c) => c.email && c.email.includes("@"));

          importContacts(
            {
              projectId,
              contacts: contactsToImport,
              listId:
                targetList !== "none" && targetList !== "new"
                  ? (targetList as number)
                  : undefined,
              newListName: targetList === "new" ? newListName : undefined,
            },
            {
              onSuccess: (data) => {
                setResult(data);
                setStep("complete");
              },
              onError: (error) => {
                // Handle validation errors
                let errorMessage = "Import failed";
                if (
                  error &&
                  typeof error === "object" &&
                  "error" in error &&
                  error.error
                ) {
                  const fieldErrors = (error.error as any).fieldErrors;
                  errorMessage =
                    fieldErrors?.contacts?.[0] ||
                    fieldErrors?.newListName?.[0] ||
                    fieldErrors?.general?.[0] ||
                    "Import failed";
                }
                setError(errorMessage);
                setStep("target");
              },
            },
          );
        },
        error: (error) => {
          setError(`Failed to parse CSV: ${error.message}`);
          setStep("mapping");
          setIsImporting(false);
        },
      });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      setError(err.message || "Failed to import contacts");
      setStep("mapping");
      setIsImporting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => {
          reset();
          setIsOpen(true);
        }}
      >
        <Upload size={16} />
        Import CSV
      </Button>

      <Dialog
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setTimeout(reset, 300); // Reset after animation finishes
        }}
        title="Import Contacts"
      >
        <div className="py-4">
          {step === "upload" && (
            <div
              className="border-2 border-dashed border-zinc-200 rounded-xl p-10 flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <Upload size={24} />
              </div>
              <div className="text-center">
                <p className="font-medium">Click or drag CSV file to upload</p>
                <p className="text-sm text-zinc-500 mt-1">
                  Maximum file size 5MB
                </p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv"
                onChange={handleFileChange}
              />
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-zinc-600 bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                <FileText size={16} className="text-blue-500" />
                <span>
                  Uploaded: <strong>{file?.name}</strong>
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Column (Required)</Label>
                  <Select
                    value={mapping.email}
                    onValueChange={(val) =>
                      setMapping((prev) => ({ ...prev, email: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select column...</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Name Column (Optional)</Label>
                  <Select
                    value={mapping.name}
                    onValueChange={(val) =>
                      setMapping((prev) => ({ ...prev, name: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border border-zinc-100 rounded-lg overflow-hidden">
                <div className="bg-zinc-50 px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase">
                  Preview
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead className="border-b border-zinc-100">
                      <tr>
                        {headers.slice(0, 3).map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-1 font-medium text-zinc-500 bg-zinc-50/50"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-zinc-50 last:border-0"
                        >
                          {row.slice(0, 3).map((cell, j) => (
                            <td key={j} className="px-3 py-1 text-zinc-600">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="ghost" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button
                  disabled={!mapping.email}
                  onClick={() => setStep("target")}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === "target" && (
            <div className="space-y-6">
              <div className="space-y-4">
                <Label>Where should we add these contacts?</Label>
                <div className="space-y-3">
                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      targetList === "none"
                        ? "border-blue-500 bg-blue-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="target"
                      value="none"
                      checked={targetList === "none"}
                      onChange={handleTargetListChange}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium">
                        Do not add to any list
                      </p>
                      <p className="text-xs text-zinc-500">
                        Only add to the global contact database
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      targetList === "new"
                        ? "border-blue-500 bg-blue-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="target"
                      value="new"
                      checked={targetList === "new"}
                      onChange={handleTargetListChange}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Create a new list</p>
                      {targetList === "new" && (
                        <Input
                          placeholder="Imported Contacts - Dec 21"
                          className="mt-2"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          autoFocus
                        />
                      )}
                    </div>
                  </label>

                  {lists.length > 0 && (
                    <div
                      className={`p-3 rounded-lg border ${
                        targetList !== "none" && targetList !== "new"
                          ? "border-blue-500 bg-blue-50"
                          : "border-zinc-200"
                      }`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer mb-2">
                        <input
                          type="radio"
                          name="target"
                          value={lists[0].id}
                          checked={
                            targetList !== "none" && targetList !== "new"
                          }
                          onChange={handleTargetListChange}
                          className="w-4 h-4 text-blue-600"
                        />
                        <p className="text-sm font-medium">
                          Add to existing list
                        </p>
                      </label>
                      {targetList !== "none" && targetList !== "new" && (
                        <Select
                          value={String(targetList)}
                          onValueChange={(val) => setTargetList(Number(val))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select list" />
                          </SelectTrigger>
                          <SelectContent>
                            {lists.map((l) => (
                              <SelectItem key={l.id} value={String(l.id)}>
                                {l.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="ghost" onClick={() => setStep("mapping")}>
                  Back
                </Button>
                <Button
                  disabled={
                    (targetList === "new" && !newListName) || isImporting
                  }
                  onClick={startImport}
                >
                  {isImporting ? "Importing..." : "Import Contacts"}
                </Button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="py-10 flex flex-col items-center justify-center gap-4">
              <Loader2 size={40} className="text-blue-500 animate-spin" />
              <div className="text-center">
                <p className="font-medium">Importing contacts...</p>
                <p className="text-sm text-zinc-500 mt-1">
                  This may take a moment depending on the file size.
                </p>
              </div>
            </div>
          )}

          {step === "complete" && (
            <div className="py-6 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <Check size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold">Import Complete!</h3>
                <div className="mt-2 space-y-1">
                  <p className="text-zinc-600 text-sm">
                    Processed <strong>{result?.total}</strong> contacts.
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs font-medium">
                    <span className="text-green-600 bg-green-50 px-2 py-1 rounded">
                      {result?.newCount} new
                    </span>
                    <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {result?.updatedCount} updated
                    </span>
                  </div>
                </div>
              </div>
              <Button onClick={() => setIsOpen(false)} className="mt-4 w-full">
                Close
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 border border-red-100">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </Dialog>
    </>
  );
}

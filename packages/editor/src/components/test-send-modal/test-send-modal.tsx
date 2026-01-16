"use client";

import React, { useState, useEffect } from "react";
import { Dialog, Button, Input, FormField } from "@senlo/ui";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import styles from "./test-send-modal.module.css";
import { useEditorStore } from "../../state/editor.store";
import { renderEmailDesign } from "@senlo/core";

interface TestSendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = "senlo_last_test_email";
const FROM_STORAGE_KEY = "senlo_last_test_from_email";

export const TestSendModal = ({ isOpen, onClose }: TestSendModalProps) => {
  const [email, setEmail] = useState("");
  const [fromEmail, setFromEmail] = useState("hello@senlo.io");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const design = useEditorStore((s) => s.design);
  const templateId = useEditorStore((s) => s.templateId);
  const subject = useEditorStore((s) => s.templateSubject);
  const onSendTest = useEditorStore((s) => s.onSendTest);

  useEffect(() => {
    if (isOpen) {
      const lastEmail = localStorage.getItem(STORAGE_KEY);
      if (lastEmail) {
        setEmail(lastEmail);
      }
      const lastFromEmail = localStorage.getItem(FROM_STORAGE_KEY);
      if (lastFromEmail) {
        setFromEmail(lastFromEmail);
      }
      setStatus("idle");
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fromEmail || !onSendTest || !templateId) return;

    setStatus("sending");
    setErrorMessage(null);

    try {
      localStorage.setItem(STORAGE_KEY, email);
      localStorage.setItem(FROM_STORAGE_KEY, fromEmail);
      
      const result = await onSendTest(templateId, email, fromEmail, design, subject);
      
      if (result.success) {
        setStatus("success");
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setStatus("error");
        setErrorMessage(result.error || "Failed to send test email");
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred");
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Send a test email"
      description="See how your email looks in a real inbox."
    >
      <div className={styles.container}>
        {status === "success" ? (
          <div className={styles.successState}>
            <CheckCircle2 size={48} className={styles.successIcon} />
            <h3>Email Sent!</h3>
            <p>Check your inbox at <strong>{email}</strong></p>
          </div>
        ) : (
          <form onSubmit={handleSend} className={styles.form}>
            <div className="space-y-4 mb-6">
              <FormField label="From Email" description="The email address that will appear as the sender.">
                <Input
                  type="email"
                  placeholder="sender@example.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  required
                  disabled={status === "sending"}
                />
              </FormField>

              <FormField label="Recipient Email" description="Enter the email address where you want to receive the test.">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === "sending"}
                  autoFocus
                />
              </FormField>
            </div>

            {status === "error" && (
              <div className={styles.errorState}>
                <AlertCircle size={20} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={onClose} disabled={status === "sending"}>
                Cancel
              </Button>
              <Button type="submit" disabled={status === "sending" || !email}>
                {status === "sending" ? (
                  <>
                    <Loader2 size={18} className={styles.spinner} />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send Test
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
};

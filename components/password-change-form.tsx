"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { changePassword } from "@/lib/auth"
import { text, type LanguageMode } from "@/lib/language"

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-70 sm:w-64"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-stretch gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="min-w-0 text-sm font-medium text-foreground">{label}</p>
      {children}
    </div>
  )
}

export function PasswordChangeForm({ language }: { language: LanguageMode }) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(text(language, { en: "All fields are required.", ja: "すべての項目を入力してください。" }))
      return
    }
    if (newPassword.length < 8) {
      setError(text(language, { en: "New password must be at least 8 characters.", ja: "新しいパスワードは8文字以上にしてください。" }))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(text(language, { en: "New password and confirmation do not match.", ja: "新しいパスワードと確認が一致しません。" }))
      return
    }

    setLoading(true)
    try {
      const response = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setSuccess(response.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : text(language, { en: "Failed to change password.", ja: "パスワード変更に失敗しました。" }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Row label={text(language, { en: "Current password", ja: "現在のパスワード" })}>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          className={inputCls}
        />
      </Row>
      <Row label={text(language, { en: "New password", ja: "新しいパスワード" })}>
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          className={inputCls}
        />
      </Row>
      <Row label={text(language, { en: "Confirm new password", ja: "確認" })}>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          className={inputCls}
        />
      </Row>
      {(error || success) && (
        <div className={`px-5 py-2 text-xs ${error ? "text-destructive" : "text-success"}`}>
          {error ?? success}
        </div>
      )}
      <div className="flex justify-end px-5 py-3.5">
        <Button size="sm" type="submit" disabled={loading}>
          {loading
            ? text(language, { en: "Changing...", ja: "変更中..." })
            : text(language, { en: "Change password", ja: "パスワード変更" })}
        </Button>
      </div>
    </form>
  )
}

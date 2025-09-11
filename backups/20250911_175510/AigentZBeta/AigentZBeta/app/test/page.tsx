"use client";

import { useState, useEffect } from "react";

export default function TestPage() {
  const [message, setMessage] = useState("Loading test page...");

  useEffect(() => {
    setMessage("Test page loaded successfully without any custom components.");
  }, []);

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">Browser Test Page</h1>
      <p className="mb-4">{message}</p>
      <div className="bg-slate-800 p-4 rounded-md">
        <p>This is a minimal test page with no custom debug tools or components.</p>
        <p className="mt-2">If this page loads in the Windsurf browser without crashing, the issue is likely in one of the main components.</p>
      </div>
    </div>
  );
}

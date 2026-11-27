import { forwardRef, useRef } from "react";

// Native date fields vary by browser: clicking the text portion may only focus them.
// Ask the browser to show its picker, and fall back to focus on unsupported/locked browsers.
const DateInput = forwardRef(function DateInput({ onClick, picker = false, onChange, ...props }, forwardedRef) {
  const pickerRef = useRef(null);
  if (picker && props.type !== "date" && props.type !== "datetime-local") {
    return <span className="relative block">
      <input {...props} ref={forwardedRef} onClick={(event) => {
        try { pickerRef.current?.showPicker(); } catch { try { pickerRef.current?.focus(); } catch { /* Native fallback is unavailable. */ } }
        onClick?.(event);
      }} />
      <input ref={pickerRef} type="date" tabIndex={-1} aria-hidden="true" onChange={onChange} className="pointer-events-none absolute left-0 top-0 h-px w-px opacity-0" />
    </span>;
  }
  return (
    <input
      {...props}
      ref={forwardedRef}
      // onChange was taken out of props above (for the picker variant); pass it on here too, or the
      // field ignores what's picked and every date stays empty
      onChange={onChange}
      onClick={(event) => {
        const input = event.currentTarget;
        const clickedNativeIcon = event.nativeEvent.offsetX >= input.clientWidth - 36;
        if (!clickedNativeIcon) {
          try {
            if (typeof input.showPicker === "function") input.showPicker();
            else input.focus();
          } catch {
            try { input.focus(); } catch { /* Native fallback is unavailable. */ }
          }
        }
        onClick?.(event);
      }}
      onFocus={(event) => {
        props.onFocus?.(event);
      }}
    />
  );
});

export default DateInput;

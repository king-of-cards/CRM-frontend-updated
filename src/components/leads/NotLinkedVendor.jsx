// Shown to a vendor login that isn't linked to a vendor (the API answers 403 for its leads)
export const NOT_LINKED_TEXT = "This login isn't linked to a vendor yet; ask an admin";

export default function NotLinkedVendor() {
  return (
    <div role="alert" className="mt-6 rounded-2xl bg-white p-8 text-center ring-1 ring-gray-100">
      <p className="text-sm text-gray-600">{NOT_LINKED_TEXT}</p>
    </div>
  );
}

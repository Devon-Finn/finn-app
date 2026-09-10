/* Bank transaction-export paths — DATA, not prompt (Devon's ruling):
   bank interfaces change, and confidently wrong instructions are worse
   than none, so the steps live here where they can be corrected without
   touching the locked prompt. Appended to the system prompt at request
   time as a reference section.

   Wording discipline: each path is phrased with "usually" because these
   drift; Finn's conduct already says to lean on what the person actually
   sees on their screen when the guidance doesn't match. Devon reviews and
   refreshes this file; last reviewed 2026-09-10. */

export const BANK_EXPORTS = {
  generic: "Log in on a computer if you can, internet banking usually exports more history than the app. Open the account, look for its transaction list, then look for a button or menu called Export, Download, or a printer/share icon near the search and date filters. Choose CSV as the format and set the date range to the last twelve months. If the site caps the range, export it in two or three pieces and send each one.",
  banks: [
    { name: "CommBank (CBA)", path: "NetBank on the web usually works best: log in, open the account, use the search and filter above the transaction list to set the date range to twelve months, then look for the Export link near the top of the list and choose CSV." },
    { name: "NAB", path: "NAB internet banking on the web: open the account, choose Transactions, set the date range to twelve months, then look for Export or Download above the list and choose CSV." },
    { name: "ANZ", path: "ANZ Internet Banking on the web: open the account, go to the transaction list, set the date range, then look for Download or Export near the list and choose CSV." },
    { name: "Westpac", path: "Westpac Online Banking on the web: open the account, view transactions, set the date range to twelve months, then look for Export at the top of the list and choose CSV." },
    { name: "ING", path: "ING on the web: open the account, go to the transaction history, set the period to the last twelve months, then look for Download and choose CSV." },
    { name: "Macquarie", path: "Macquarie online banking or the app: open the account, go to transactions, set the date range, then look for Download or Export and choose CSV." },
    { name: "Bendigo Bank", path: "Bendigo e-banking on the web: open the account, view the transaction list, set the date range, then look for Export and choose CSV." },
    { name: "Bankwest", path: "Bankwest online banking on the web: open the account, go to transactions, set the date range to twelve months, then look for Export and choose CSV." },
    { name: "St George", path: "St George internet banking on the web: open the account, view transactions, set the date range, then look for Export at the top of the list and choose CSV." },
    { name: "Suncorp", path: "Suncorp internet banking on the web: open the account, go to the transaction list, set the date range, then look for Export or Download and choose CSV." },
    { name: "Up", path: "Up is app-first: in the Up app, open the account, tap the profile or account icon, look for Documents or Statements, and choose Export transactions to get a CSV for your date range." },
  ],
};

export function bankExportsPromptSection() {
  return "\n\n═══ BANK EXPORT PATHS (reference data — reviewed separately from this prompt; interfaces drift, so where the person's screen disagrees with these steps, trust their screen and guide by concept) ═══\n\n" +
    "Generic, for any bank not listed: " + BANK_EXPORTS.generic + "\n\n" +
    BANK_EXPORTS.banks.map(b => "- " + b.name + ": " + b.path).join("\n");
}

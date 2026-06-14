# Import format

The importer (Export & Import panel → **Choose file to import**) accepts **JSON**, **CSV**, or **Excel (.xlsx)**. New members merge into the active family; existing ones are skipped. This doc focuses on **how relationships are represented**, because that is the part people get wrong.

> Source of truth: `src/shared/importData.ts` (parsers + `planMerge`) and `src/shared/exportData.ts` (`buildCSV` / `buildCSVTemplate` / `buildJSON`). A file produced by **Export** always re-imports cleanly.

---

## The two halves of a file

Every import has **members** and (optionally) **relationships**. Relationships reference members by an **`id`** — a string you assign. The `id` only needs to be unique *within the file*; it is used to wire edges and is then discarded (Firestore assigns real ids on write).

### Members
Columns (all optional except `name`):

```
id, name, gender, birthDate, deathDate, phone, email, address, location, occupation, maidenName, placeOfBirth
```

- `gender`: `male` | `female` | `other`
- `birthDate` / `deathDate`: ISO `YYYY-MM-DD` (or just `YYYY`). Used for the timeline and for de-duplication.

### Relationships
Columns:

```
fromId, toId, type, status, marriageDate
```

- `type`: `parent` | `spouse` | `sibling`
- `status` (spouse only): `current` | `divorced`
- `marriageDate` (spouse only): ISO date — powers the anniversary events on the timeline.

---

## Relationship conventions (important)

### `parent` — directed, `fromId` = CHILD, `toId` = PARENT
A `parent` edge points **from the child to the parent**. To say *Nikhil is the child of Asha*:

```
fromId,toId,type
nikhil,asha,parent
```

One row per (child, parent) pair. A child with two parents has **two** `parent` rows.

### `spouse` — bidirectional, write BOTH directions
A marriage is two rows (A→B and B→A) so the link resolves from either person:

```
fromId,toId,type,status,marriageDate
asha,ravi,spouse,current,1970-12-02
ravi,asha,spouse,current,1970-12-02
```

Use `status=divorced` for former partners. If you only write one direction the importer still stores it, but writing both matches what Export produces and avoids surprises in the visuals.

### `sibling` — usually inferred, not imported
Siblings are derived from **shared parents** in the tree views — you normally do **not** need `sibling` rows. Just give two people the same `parent` edges and they show up as siblings. (Explicit `sibling` rows are accepted if present.)

---

## De-duplication (what gets skipped)

- A **member** is treated as a duplicate when an existing member has the **same `name` + `birthDate`** — it is skipped, and any relationships that referenced it are rewired to the existing person.
- A **relationship** is skipped when the same `fromId|toId|type` already exists (after id rewiring), so re-importing the same file does nothing.

---

## Format specifics

### CSV
Two labelled sections. Section markers are lines starting with `#`:

```
# MEMBERS
id,name,gender,birthDate,deathDate,phone,email,address,location,occupation,maidenName,placeOfBirth
p1,Asha Sharma,female,1948-02-11,,,asha@example.com,,Mumbai,Teacher,Verma,Pune
p2,Ravi Sharma,male,1944-07-30,2018-03-12,,,,,Engineer,,Delhi
p3,Nikhil Sharma,male,1972-10-05,,,nikhil@example.com,,Bengaluru,Designer,,Mumbai

# RELATIONSHIPS
fromId,toId,type,status,marriageDate
p3,p1,parent,,
p3,p2,parent,,
p1,p2,spouse,current,1970-12-02
p2,p1,spouse,current,1970-12-02
```

A **plain members-only CSV** (a single header row containing a `name` column, no `#` sections) also imports — handy for spreadsheets exported elsewhere. Download the ready-made template from the panel (**Download CSV template**) which is exactly the example above.

### Excel (.xlsx)
A workbook with a **`Members`** sheet and a **`Relationships`** sheet, same columns as the CSV sections. If the sheets aren't named, the first sheet is read as members and the second as relationships.

### JSON
```json
{
  "version": 1,
  "members": [
    { "id": "p1", "name": "Asha Sharma", "gender": "female", "birthDate": "1948-02-11" }
  ],
  "relationships": [
    { "fromId": "p3", "toId": "p1", "type": "parent" },
    { "fromId": "p1", "toId": "p2", "type": "spouse", "status": "current", "marriageDate": "1970-12-02" }
  ]
}
```

This is the shape the **JSON export** produces, so the cleanest round-trip is: Export → edit → Import.

// Adapted from https://github.com/Airtable-Labs/upsert-examples/tree/main/javascript/using_node-fetch

import { parse as parseCsv } from "https://deno.land/std@0.82.0/encoding/csv.ts";

import { configSync } from "https://deno.land/std@0.137.0/dotenv/mod.ts";
const CONFIG = Object.assign({}, Deno.env.toObject(), configSync());

/*
AIRTABLE_API_KEY=keyXYZ
AIRTABLE_BASE_ID=appXYZ
AIRTABLE_TABLE_ID=tblXYZ
AIRTABLE_UNIQUE_FIELD_NAME=id
AIRTABLE_API_MS_TO_SLEEP=150
*/
export const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_ID,
  AIRTABLE_UNIQUE_FIELD_NAME,
  AIRTABLE_API_MS_TO_SLEEP,
} = CONFIG;

let inputRecords = await parseCsv(
  Deno.readTextFileSync("output/mozilla-standards-positions.csv"),
  {
    skipFirstRow: true,
    columns: [
      "id",
      "closed",
      "title",
      "url",
      "created_at",
      "updated_at",
      "user",
      "labels",
      "reactions",
    ],
    parse: (e) => {
      return {
        closed: e.closed === "true",
        title: e.title,
        url: e.url,
        created_at: e.created_at,
        updated_at: e.updated_at,
        user: e.user,
        labels: e.labels,
        reactions: parseInt(e.reactions),
        id: parseInt(e.id),
      };
    },
  }
);

console.log(Array.isArray(inputRecords));
// Helper function to get all records from a base. Handles pagination for you.
const getAllRecordsFromBase = async function (
  baseApiUrl,
  headers,
  pageSize = 100,
  msToSleep = 150
) {
  // Create empty array to hold all records
  const records = [];

  // Set initial request URL
  let apiRequestUrl = `${baseApiUrl}?pageSize=${pageSize}`;
  console.log(`Retrieving all records for ${apiRequestUrl}`);

  // As long as apiRequestUrl is truthy
  while (apiRequestUrl) {
    // Make request to API
    const apiRequest = await fetch(apiRequestUrl, { headers });
    const apiResponse = await apiRequest.json();

    // Add records from the API response to array
    records.push(...apiResponse.records);
    console.debug(`\trecords array now has ${records.length} items`);

    // Look at response to see if there is another page to fetch
    if (apiResponse.offset) {
      apiRequestUrl = `${baseApiUrl}?pageSize=${pageSize}&offset=${apiResponse.offset}`;
      await sleepInMs(msToSleep);
    } else {
      console.debug("\tNo further pagination required");
      apiRequestUrl = null;
    }
  }

  // Return all records
  console.debug(`\t${records.length} total records retrieved\n`);
  return records;
};

// Helper function from https://stackoverflow.com/questions/8495687/split-array-into-chunks
const chunkArray = function (arrayToChunk, chunkSize = 10) {
  const arraysOfChunks = [];
  for (let i = 0; i < arrayToChunk.length; i += chunkSize) {
    arraysOfChunks.push(arrayToChunk.slice(i, i + chunkSize));
  }
  return arraysOfChunks;
};

// Helper function to act on a chnunk of records
//   method="POST" -> create new records
//   method="PUT" -> update existing records, will clear all unspecified cell values
//   method="PATCH" -> update existing records, will only update the fields you specify, leaving the rest as they were
const actOnRecordsInChunks = async function (
  baseApiUrl,
  headers,
  records,
  method,
  msToSleep = 150
) {
  console.log(`\n${method}'ing ${records.length} records at ${baseApiUrl}`);
  const arrayOfChunks = chunkArray(records);
  for (const chunkOfRecords of arrayOfChunks) {
    console.log(`\tProcessing batch of ${chunkOfRecords.length} records`);
    const body = JSON.stringify({ records: chunkOfRecords });
    const apiRequest = await fetch(baseApiUrl, { headers, method, body });
    console.log(`\t\t${apiRequest.status} (${apiRequest.statusText})`);
    await sleepInMs(msToSleep);
  }
};

// Function which sleeps for the specified number of milliseconds. Helpful for proactively staying under API rate limits.
async function sleepInMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function that takes an array of records and returns a mapping of primary field to record ID
const createMappingOfUniqueFieldToRecordId = function (records, fieldName) {
  const mapping = {};
  for (const existingRecord of records) {
    mapping[existingRecord.fields[fieldName]] = existingRecord.id;
  }
  return mapping;
};

const baseApiUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
const airtableAuthHeaders = {
  Authorization: `Bearer ${AIRTABLE_API_KEY}`,
  "Content-Type": "application/json",
};

(async () => {
  // Retrieve all existing records from the base through the Airtable REST API
  const existingRecords = await getAllRecordsFromBase(
    baseApiUrl,
    airtableAuthHeaders,
    100,
    AIRTABLE_API_MS_TO_SLEEP
  );

  // Create an object mapping of the primary field to the record ID
  // Remember, it's assumed that the AIRTABLE_UNIQUE_FIELD_NAME field is truly unique
  const mapOfUniqueIdToExistingRecordId = createMappingOfUniqueFieldToRecordId(
    existingRecords,
    AIRTABLE_UNIQUE_FIELD_NAME
  );

  // Create two arrays: one for records to be created, one for records to be updated
  const recordsToCreate = [];
  const recordsToUpdate = [];

  // For each input record, check if it exists in the existing records. If it does, update it. If it does not, create it.
  console.log(
    `Processing ${inputRecords.length} input records to determine whether to update or create`
  );
  for (const inputRecord of inputRecords) {
    const recordUniqueFieldValue = inputRecord[AIRTABLE_UNIQUE_FIELD_NAME];
    console.debug(
      `\tProcessing record w/ '${AIRTABLE_UNIQUE_FIELD_NAME}' === '${recordUniqueFieldValue}'`
    );
    // Check for an existing record with the same unique ID as the input record
    const recordMatch = mapOfUniqueIdToExistingRecordId[recordUniqueFieldValue];

    if (recordMatch === undefined) {
      // Add record to list of records to update
      console.log("\t\tNo existing records match; adding to recordsToCreate");
      recordsToCreate.push({ fields: inputRecord });
    } else {
      // Add record to list of records to create
      console.log(
        `\t\tExisting record w/ ID ${recordMatch} found; adding to recordsToUpdate`
      );
      recordsToUpdate.push({ id: recordMatch, fields: inputRecord });
    }
  }

  // Read out array sizes
  console.log(`\nRecords to create: ${recordsToCreate.length}`);
  console.log(`Records to update: ${recordsToUpdate.length}\n`);

  // Perform record creation
  await actOnRecordsInChunks(
    baseApiUrl,
    airtableAuthHeaders,
    recordsToCreate,
    "POST",
    AIRTABLE_API_MS_TO_SLEEP
  );

  // Perform record updates on existing records
  await actOnRecordsInChunks(
    baseApiUrl,
    airtableAuthHeaders,
    recordsToUpdate,
    "PATCH",
    AIRTABLE_API_MS_TO_SLEEP
  );

  console.log("\n\nScript execution complete!");
})();

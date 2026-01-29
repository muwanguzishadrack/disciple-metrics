#!/usr/bin/env node

/**
 * Import PGA entries from Excel file into Supabase database.
 * Usage: node scripts/import-pga-excel.mjs
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

// Load environment variables from .env.local manually
function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  } catch (e) {
    console.error(`Failed to load ${filePath}:`, e.message);
  }
}

loadEnvFile('.env.local');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Configuration
const EXCEL_FILE = 'WHM PGA 18th Jan 2026 .xlsx';
const REPORT_ID = 'ed50ef9c-5882-48b8-b415-cb4c2ebe4ef5';
const REPORT_DATE = '2026-01-18';

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Parse the Excel file and extract PGA data
 */
function parseExcelFile(filePath) {
  console.log(`\nReading Excel file: ${filePath}`);

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to array of arrays
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  console.log(`Sheet name: ${sheetName}`);
  console.log(`Total rows: ${data.length}`);
  console.log(`Title row: ${data[0]?.[0] || 'N/A'}`);
  console.log(`Headers: ${data[1]?.join(', ') || 'N/A'}`);

  // Parse data rows (skip title row 0 and header row 1)
  const entries = [];
  for (let i = 2; i < data.length; i++) {
    const row = data[i];

    // Skip empty rows
    if (!row || !row[1]) continue;

    const entry = {
      rowNum: i + 1, // Excel row number (1-indexed)
      locationCode: String(row[1]).trim(),
      sv1: parseInt(row[2]) || 0,
      sv2: parseInt(row[3]) || 0,
      yxp: parseInt(row[4]) || 0,
      kids: parseInt(row[5]) || 0,
      local: parseInt(row[6]) || 0,
      hc1: parseInt(row[7]) || 0,
      hc2: parseInt(row[8]) || 0,
      // Fields not in Excel - set to 0
      salvations: 0,
      baptisms: 0,
      mca: 0,
      mechanics: 0,
    };

    entries.push(entry);
  }

  console.log(`Parsed ${entries.length} data rows`);
  return entries;
}

/**
 * Fetch all locations from database
 */
async function fetchLocations() {
  console.log('\nFetching locations from database...');

  const { data, error } = await supabase
    .from('locations')
    .select('id, name');

  if (error) {
    throw new Error(`Failed to fetch locations: ${error.message}`);
  }

  console.log(`Found ${data.length} locations in database`);
  return data;
}

/**
 * Fetch existing entries for the report
 */
async function fetchExistingEntries(reportId) {
  console.log('\nFetching existing entries for report...');

  const { data, error } = await supabase
    .from('pga_entries')
    .select('id, location_id')
    .eq('report_id', reportId);

  if (error) {
    throw new Error(`Failed to fetch entries: ${error.message}`);
  }

  console.log(`Found ${data.length} existing entries`);
  return data;
}

/**
 * Match Excel location codes to database locations
 */
function matchLocations(excelEntries, dbLocations) {
  // Create lookup map by name (location codes in Excel match location names in DB)
  const locationByName = new Map();
  for (const loc of dbLocations) {
    locationByName.set(loc.name.toUpperCase(), loc);
  }

  const matched = [];
  const unmatched = [];

  for (const entry of excelEntries) {
    const key = entry.locationCode.toUpperCase();
    const location = locationByName.get(key);

    if (location) {
      matched.push({
        ...entry,
        locationId: location.id,
        locationName: location.name,
      });
    } else {
      unmatched.push(entry);
    }
  }

  return { matched, unmatched };
}

/**
 * Import entries into database
 */
async function importEntries(matchedEntries, existingEntries, reportId) {
  // Create lookup for existing entries by location_id
  const existingByLocation = new Map();
  for (const entry of existingEntries) {
    existingByLocation.set(entry.location_id, entry.id);
  }

  let updated = 0;
  let inserted = 0;
  let errors = 0;

  console.log('\nImporting entries...');

  for (const entry of matchedEntries) {
    const entryData = {
      report_id: reportId,
      location_id: entry.locationId,
      sv1: entry.sv1,
      sv2: entry.sv2,
      yxp: entry.yxp,
      kids: entry.kids,
      local: entry.local,
      hc1: entry.hc1,
      hc2: entry.hc2,
      salvations: entry.salvations,
      baptisms: entry.baptisms,
      mca: entry.mca,
      mechanics: entry.mechanics,
    };

    const existingId = existingByLocation.get(entry.locationId);

    if (existingId) {
      // Update existing entry
      const { error } = await supabase
        .from('pga_entries')
        .update(entryData)
        .eq('id', existingId);

      if (error) {
        console.error(`  Error updating ${entry.locationName}: ${error.message}`);
        errors++;
      } else {
        updated++;
      }
    } else {
      // Insert new entry
      const { error } = await supabase
        .from('pga_entries')
        .insert(entryData);

      if (error) {
        console.error(`  Error inserting ${entry.locationName}: ${error.message}`);
        errors++;
      } else {
        inserted++;
      }
    }
  }

  return { updated, inserted, errors };
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('PGA Excel Import Script');
  console.log('='.repeat(60));
  console.log(`Target Report: ${REPORT_DATE} (${REPORT_ID})`);

  try {
    // Parse Excel file
    const excelEntries = parseExcelFile(EXCEL_FILE);

    // Fetch data from database
    const [locations, existingEntries] = await Promise.all([
      fetchLocations(),
      fetchExistingEntries(REPORT_ID),
    ]);

    // Match locations
    console.log('\nMatching locations...');
    const { matched, unmatched } = matchLocations(excelEntries, locations);
    console.log(`  Matched: ${matched.length}`);
    console.log(`  Unmatched: ${unmatched.length}`);

    if (unmatched.length > 0) {
      console.log('\nUnmatched location codes:');
      for (const entry of unmatched) {
        console.log(`  Row ${entry.rowNum}: "${entry.locationCode}"`);
      }
    }

    // Import entries
    const { updated, inserted, errors } = await importEntries(
      matched,
      existingEntries,
      REPORT_ID
    );

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Excel rows parsed:    ${excelEntries.length}`);
    console.log(`Locations matched:    ${matched.length}`);
    console.log(`Locations unmatched:  ${unmatched.length}`);
    console.log(`Entries updated:      ${updated}`);
    console.log(`Entries inserted:     ${inserted}`);
    console.log(`Errors:               ${errors}`);
    console.log('='.repeat(60));

    if (errors > 0) {
      process.exit(1);
    }

    console.log('\nImport completed successfully!');
    console.log(`View report at: /reports/${REPORT_DATE}`);

  } catch (error) {
    console.error('\nFatal error:', error.message);
    process.exit(1);
  }
}

main();

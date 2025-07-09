/**
 * Manual migration utilities for fixing existing data issues
 */

import { companyStorage, mvvStorage } from './storage';
import { migrateCompanyStatuses } from './dataMigration';
import { generateEmbeddings } from './openai';

/**
 * Force re-migration of all company data
 * This function should be called from browser console if needed
 */
export async function forceMigration() {
  try {
    console.log('Starting force migration...');
    
    // Get all companies
    const companies = await companyStorage.getAll();
    console.log(`Found ${companies.length} companies`);

    // Reset all companies with old "completed" status to force re-migration
    for (const company of companies) {
      if (company.status === 'mvv_extracted' || company.status === 'fully_completed') {
        // Temporarily set to old "completed" status to trigger migration
        await companyStorage.update(company.id, { 
          status: 'completed' as any 
        });
      }
    }

    // Run migration
    const result = await migrateCompanyStatuses();
    console.log('Force migration result:', result);

    return result;
  } catch (error) {
    console.error('Force migration failed:', error);
    throw error;
  }
}

/**
 * Fix MVV data access issues for specific companies
 */
export async function fixMVVDataAccess(companyIds?: string[]) {
  try {
    console.log('Fixing MVV data access...');
    
    const companies = companyIds 
      ? await Promise.all(companyIds.map(id => companyStorage.getById(id)).filter(Boolean)) as any[]
      : await companyStorage.getAll();

    let fixedCount = 0;

    for (const company of companies) {
      if (!company) continue;

      // Skip if company already has MVV data
      if (company.mission || company.vision || company.values) {
        continue;
      }

      // Get MVV data from storage
      const mvvData = await mvvStorage.getActiveByCompanyId(company.id);
      if (mvvData) {
        await companyStorage.update(company.id, {
          mission: mvvData.mission || undefined,
          vision: mvvData.vision || undefined,
          values: Array.isArray(mvvData.values) ? mvvData.values.join(', ') : mvvData.values || undefined
        });
        
        console.log(`Fixed MVV data for company: ${company.name}`);
        fixedCount++;
      }
    }

    console.log(`Fixed MVV data access for ${fixedCount} companies`);
    return fixedCount;

  } catch (error) {
    console.error('Failed to fix MVV data access:', error);
    throw error;
  }
}

/**
 * Fix status inconsistencies where companies have MVV data but wrong status
 */
export async function fixStatusInconsistencies() {
  try {
    console.log('Fixing status inconsistencies...');
    
    const companies = await companyStorage.getAll();
    let fixedCount = 0;
    const fixes = [];

    for (const company of companies) {
      const mvvData = await mvvStorage.getActiveByCompanyId(company.id);
      
      if (mvvData) {
        let needsUpdate = false;
        let newStatus = company.status;
        let updates: any = {};

        // Copy MVV data to company if missing
        if (!company.mission && mvvData.mission) {
          updates.mission = mvvData.mission;
          needsUpdate = true;
        }
        if (!company.vision && mvvData.vision) {
          updates.vision = mvvData.vision;
          needsUpdate = true;
        }
        if (!company.values && mvvData.values) {
          updates.values = Array.isArray(mvvData.values) ? mvvData.values.join(', ') : mvvData.values;
          needsUpdate = true;
        }

        // Fix status if inconsistent
        if (company.status === 'pending' || company.status === 'error') {
          if (company.embeddings && company.embeddings.length > 0) {
            newStatus = 'fully_completed';
          } else {
            newStatus = 'mvv_extracted';
          }
          updates.status = newStatus;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await companyStorage.update(company.id, updates);
          
          const fix = {
            companyName: company.name,
            oldStatus: company.status,
            newStatus,
            updatedFields: Object.keys(updates)
          };
          fixes.push(fix);
          fixedCount++;
          
          console.log(`Fixed ${company.name}: ${company.status} → ${newStatus}`);
        }
      }
    }

    console.log(`Fixed ${fixedCount} status inconsistencies`);
    if (fixes.length > 0) {
      console.table(fixes);
    }
    
    return { fixedCount, fixes };

  } catch (error) {
    console.error('Failed to fix status inconsistencies:', error);
    throw error;
  }
}

/**
 * Debug function to check company and MVV data alignment
 */
export async function debugDataAlignment() {
  try {
    const companies = await companyStorage.getAll();
    const report = [];
    const inconsistencies = [];

    for (const company of companies) {
      const mvvData = await mvvStorage.getActiveByCompanyId(company.id);
      
      const hasCompanyMVV = !!(company.mission || company.vision || company.values);
      const hasStorageMVV = !!mvvData;
      const hasEmbeddings = !!(company.embeddings && company.embeddings.length > 0);
      
      // Check for inconsistencies
      if (hasStorageMVV && company.status === 'pending') {
        inconsistencies.push({
          companyName: company.name,
          issue: 'Has MVV data but status is pending',
          expectedStatus: hasEmbeddings ? 'fully_completed' : 'mvv_extracted'
        });
      }
      
      if (hasStorageMVV && !hasCompanyMVV) {
        inconsistencies.push({
          companyName: company.name,
          issue: 'MVV data exists in storage but not in company',
          action: 'Copy MVV data to company'
        });
      }
      
      const item = {
        companyName: company.name,
        companyStatus: company.status,
        hasCompanyMVV,
        hasStorageMVV,
        hasEmbeddings,
        needsUpdate: hasStorageMVV && company.status === 'pending',
        companyMVV: {
          mission: company.mission,
          vision: company.vision,
          values: company.values
        },
        storageMVV: mvvData ? {
          mission: mvvData.mission,
          vision: mvvData.vision,
          values: mvvData.values
        } : null
      };
      
      report.push(item);
    }

    console.log('=== DATA ALIGNMENT REPORT ===');
    console.table(report);
    
    if (inconsistencies.length > 0) {
      console.log('\n=== INCONSISTENCIES FOUND ===');
      console.table(inconsistencies);
      console.log(`Found ${inconsistencies.length} inconsistencies that need to be fixed`);
    } else {
      console.log('\n✅ No inconsistencies found');
    }
    
    return { report, inconsistencies };

  } catch (error) {
    console.error('Debug alignment failed:', error);
    throw error;
  }
}

/**
 * Debug specific company data
 */
export async function debugCompanyData(companyName: string) {
  try {
    const companies = await companyStorage.getAll();
    const company = companies.find(c => c.name.includes(companyName));
    
    if (!company) {
      console.log(`Company containing "${companyName}" not found`);
      return null;
    }
    
    const mvvData = await mvvStorage.getActiveByCompanyId(company.id);
    
    const debug = {
      companyInfo: {
        id: company.id,
        name: company.name,
        status: company.status,
        hasEmbeddings: !!(company.embeddings && company.embeddings.length > 0),
        embeddingsLength: company.embeddings?.length || 0,
        hasMVVInCompany: !!(company.mission || company.vision || company.values)
      },
      mvvStorageData: mvvData ? {
        id: mvvData.id,
        hasData: true,
        mission: mvvData.mission,
        vision: mvvData.vision,
        values: mvvData.values,
        source: mvvData.source,
        extractedAt: mvvData.extractedAt
      } : null,
      fullCompanyObject: company
    };
    
    console.log('=== COMPANY DEBUG DATA ===');
    console.log('Company Name:', company.name);
    console.log('Company Info:', debug.companyInfo);
    console.log('MVV Storage Data:', debug.mvvStorageData);
    console.log('Full Company Object:', debug.fullCompanyObject);
    
    return debug;
  } catch (error) {
    console.error('Failed to debug company data:', error);
    throw error;
  }
}

/**
 * Debug embeddings data across all companies
 */
export async function debugEmbeddingsData() {
  try {
    const companies = await companyStorage.getAll();
    
    console.log('=== EMBEDDINGS DEBUG REPORT ===');
    console.log(`Total companies: ${companies.length}`);
    
    const embeddingsReport = [];
    let companiesWithEmbeddings = 0;
    let companiesWithoutEmbeddings = 0;
    let fullyCompletedWithoutEmbeddings = 0;
    
    for (const company of companies) {
      const hasEmbeddings = !!(company.embeddings && company.embeddings.length > 0);
      const embeddingsLength = company.embeddings?.length || 0;
      
      if (hasEmbeddings) {
        companiesWithEmbeddings++;
      } else {
        companiesWithoutEmbeddings++;
        if (company.status === 'fully_completed') {
          fullyCompletedWithoutEmbeddings++;
        }
      }
      
      const reportItem = {
        companyName: company.name,
        status: company.status,
        hasEmbeddings,
        embeddingsLength,
        hasMVV: !!(company.mission || company.vision || company.values),
        shouldShowEmbeddingsButton: hasEmbeddings
      };
      
      embeddingsReport.push(reportItem);
    }
    
    console.log(`Companies with embeddings: ${companiesWithEmbeddings}`);
    console.log(`Companies without embeddings: ${companiesWithoutEmbeddings}`);
    console.log(`Fully completed but missing embeddings: ${fullyCompletedWithoutEmbeddings}`);
    
    console.log('\n=== EMBEDDINGS DATA BY COMPANY ===');
    console.table(embeddingsReport);
    
    // Find companies that should show embeddings button
    const shouldShowButton = embeddingsReport.filter(item => item.shouldShowEmbeddingsButton);
    console.log(`\nCompanies that should show Embeddings button: ${shouldShowButton.length}`);
    if (shouldShowButton.length > 0) {
      console.table(shouldShowButton);
    }
    
    // Find inconsistencies
    const inconsistencies = embeddingsReport.filter(item => 
      item.status === 'fully_completed' && !item.hasEmbeddings
    );
    
    if (inconsistencies.length > 0) {
      console.log('\n=== INCONSISTENCIES FOUND ===');
      console.log('Companies marked as fully_completed but missing embeddings:');
      console.table(inconsistencies);
    }
    
    return {
      totalCompanies: companies.length,
      companiesWithEmbeddings,
      companiesWithoutEmbeddings,
      fullyCompletedWithoutEmbeddings,
      shouldShowButtonCount: shouldShowButton.length,
      inconsistencies: inconsistencies.length,
      report: embeddingsReport
    };
    
  } catch (error) {
    console.error('Failed to debug embeddings data:', error);
    throw error;
  }
}

/**
 * Emergency restore companies from MVV data and hybrid data
 */
export async function emergencyRestoreCompanies() {
  try {
    console.log('=== EMERGENCY COMPANY RESTORE ===');
    
    // Check current state
    const companies = await companyStorage.getAll();
    const mvvData = await mvvStorage.getAll();
    
    console.log(`Current companies: ${companies.length}`);
    console.log(`Available MVV data: ${mvvData.length}`);
    
    if (companies.length > 0) {
      console.log('Companies already exist, skipping restore');
      return { restored: 0, reason: 'Companies already exist' };
    }
    
    // Try to restore from hybrid data (JSON file)
    const hybridResponse = await fetch('/mvv-analysis-data.json');
    let hybridData = [];
    if (hybridResponse.ok) {
      hybridData = await hybridResponse.json();
      console.log(`Found ${hybridData.length} companies in hybrid data`);
    }
    
    // Create companies from MVV data
    const companiesFromMVV = new Map();
    mvvData.forEach(mvv => {
      if (!companiesFromMVV.has(mvv.companyId)) {
        companiesFromMVV.set(mvv.companyId, mvv);
      }
    });
    
    console.log(`Creating ${companiesFromMVV.size} companies from MVV data`);
    
    let restored = 0;
    for (const [companyId, mvv] of companiesFromMVV) {
      // Find matching hybrid data
      const hybridMatch = hybridData.find((h: any) => h.id === companyId);
      
      const company = {
        id: companyId,
        name: hybridMatch?.name || `Company ${companyId}`,
        website: hybridMatch?.website || '',
        category: hybridMatch?.category || 'ヘルスケア',
        notes: hybridMatch?.notes || '',
        status: 'mvv_extracted' as const,
        mission: mvv.mission || undefined,
        vision: mvv.vision || undefined,
        values: Array.isArray(mvv.values) ? mvv.values.join(', ') : mvv.values || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastProcessed: new Date(mvv.extractedAt)
      };
      
      await companyStorage.create(company);
      restored++;
      
      console.log(`Restored: ${company.name}`);
    }
    
    console.log(`✅ Restored ${restored} companies`);
    return { restored, companies: restored };
    
  } catch (error) {
    console.error('Failed to restore companies:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Check database state and data integrity
 */
export async function checkDatabaseState() {
  try {
    console.log('=== DATABASE STATE CHECK ===');
    
    // Check companies table
    const companies = await companyStorage.getAll();
    console.log(`Companies in database: ${companies.length}`);
    
    // Check MVV storage
    const mvvData = await mvvStorage.getAll();
    console.log(`MVV data entries: ${mvvData.length}`);
    
    // Show first few companies for debugging
    if (companies.length > 0) {
      console.log('First 3 companies:');
      companies.slice(0, 3).forEach(company => {
        console.log(`- ${company.name} (${company.status})`);
      });
    }
    
    // Show MVV data distribution
    const mvvByCompany = new Map();
    mvvData.forEach(mvv => {
      const count = mvvByCompany.get(mvv.companyId) || 0;
      mvvByCompany.set(mvv.companyId, count + 1);
    });
    
    console.log(`MVV data covers ${mvvByCompany.size} companies`);
    
    return {
      companiesCount: companies.length,
      mvvDataCount: mvvData.length,
      mvvCoverage: mvvByCompany.size,
      companies: companies.slice(0, 5) // First 5 for inspection
    };
    
  } catch (error) {
    console.error('Failed to check database state:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Test embeddings generation for a specific company
 */
export async function testEmbeddingsGeneration(companyName: string) {
  try {
    const companies = await companyStorage.getAll();
    const company = companies.find(c => c.name.includes(companyName));
    
    if (!company) {
      console.log(`Company containing "${companyName}" not found`);
      return null;
    }
    
    console.log(`Testing embeddings generation for: ${company.name}`);
    console.log(`Current status: ${company.status}`);
    console.log(`Has embeddings: ${!!(company.embeddings && company.embeddings.length > 0)}`);
    
    // Check if company has MVV data
    let mvvText = '';
    
    if (company.mission || company.vision || company.values) {
      mvvText = [
        company.mission ? `Mission: ${company.mission}` : '',
        company.vision ? `Vision: ${company.vision}` : '',
        company.values ? `Values: ${company.values}` : ''
      ].filter(Boolean).join('\n');
      console.log('Using company-stored MVV data');
    } else {
      const mvvData = await mvvStorage.getActiveByCompanyId(company.id);
      if (mvvData) {
        mvvText = [
          mvvData.mission ? `Mission: ${mvvData.mission}` : '',
          mvvData.vision ? `Vision: ${mvvData.vision}` : '',
          mvvData.values ? `Values: ${Array.isArray(mvvData.values) ? mvvData.values.join(', ') : mvvData.values}` : ''
        ].filter(Boolean).join('\n');
        console.log('Using MVV storage data');
      }
    }
    
    if (!mvvText) {
      console.error('No MVV data found for embeddings generation');
      return null;
    }
    
    console.log('MVV Text for embeddings:', mvvText);
    
    // Generate embeddings
    console.log('Generating embeddings...');
    const embeddings = await generateEmbeddings(mvvText);
    
    console.log(`Generated ${embeddings.length} dimensions`);
    
    // Update company with embeddings
    console.log('Updating company with embeddings...');
    
    await companyStorage.update(company.id, {
      embeddings,
      status: 'fully_completed',
      errorMessage: undefined
    });
    
    console.log('✅ Embeddings generation test completed successfully');
    
    // Verify the update
    const updatedCompany = await companyStorage.getById(company.id);
    console.log('Updated company embeddings length:', updatedCompany?.embeddings?.length || 0);
    console.log('Updated company status:', updatedCompany?.status);
    
    return {
      success: true,
      embeddingsLength: embeddings.length,
      companyStatus: updatedCompany?.status,
      hasEmbeddings: !!(updatedCompany?.embeddings && updatedCompany.embeddings.length > 0)
    };
    
  } catch (error) {
    console.error('Embeddings generation test failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Export to global scope for browser console access
if (typeof window !== 'undefined') {
  (window as any).mvvDebug = {
    forceMigration,
    fixMVVDataAccess,
    fixStatusInconsistencies,
    debugDataAlignment,
    debugCompanyData,
    debugEmbeddingsData,
    testEmbeddingsGeneration,
    checkDatabaseState,
    emergencyRestoreCompanies
  };
  
  console.log('MVV Debug tools available at window.mvvDebug');
  console.log('Available functions:');
  console.log('- window.mvvDebug.checkDatabaseState() - Check database integrity');
  console.log('- window.mvvDebug.debugEmbeddingsData() - Debug embeddings data');
  console.log('- window.mvvDebug.testEmbeddingsGeneration("company name") - Test embeddings generation');
  console.log('- window.mvvDebug.fixStatusInconsistencies() - Fix status issues');
  console.log('- window.mvvDebug.fixMVVDataAccess() - Fix MVV data access');
}
// Helper to sync LMS data to Learning Tokens Backend

export async function syncLmsDataToLearningTokens(lmsData, instructorToken, backendUrl = 'http://localhost:3000') {
  try {
    const response = await fetch(`${backendUrl}/api/lms-integration/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${instructorToken}`
      },
      body: JSON.stringify(lmsData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('LMS Sync Error:', error);
    throw error;
  }
}


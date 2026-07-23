/**
 * @OnlyCurrentDoc
 */

// --- Global Configuration ---
const FOLDER_ID = "1DUBPjC6wO1W0Eci2kbodxKZXqmxV03By"; // Your Google Drive Folder ID

const USER_SHEET_NAME = "User";
const READINGS_SHEET_NAME = "Readings";

// --- Web App Entry Points ---

function doGet(e) {
  return ContentService.createTextOutput("Bike Reading API is running.");
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result = {};

    switch(action) {
      case 'getUsernames':
        result = { status: 'success', data: getUsernames() };
        break;
      case 'authenticateUser':
        result = authenticateUser(data.username, data.password);
        break;
      case 'getInitializationData':
        result = getInitializationData(data.username);
        break;
      case 'reverseGeocode':
        result = { status: 'success', address: reverseGeocode(data.lat, data.lon) };
        break;
      case 'processSubmission':
        result = processSubmission(data.formObject, data.imageFile);
        break;
      default:
        result = { status: 'error', message: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Helper function to parse username ---
function parseUsername(fullUsername) {
  const parts = fullUsername.split(' | ');
  if (parts.length === 2) {
    return { personName: parts[0].trim(), bikeNumber: parts[1].trim() };
  }
  return { personName: fullUsername, bikeNumber: 'N/A' };
}


// --- Authentication ---

function getUsernames() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(USER_SHEET_NAME);
    if (!sheet) throw new Error(`Sheet "${USER_SHEET_NAME}" not found.`);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const data = sheet.getRange("A2:A" + lastRow).getValues();
    return data.map(row => row[0]).filter(String);
  } catch (e) {
    Logger.log(`Error in getUsernames: ${e.toString()}`);
    return [];
  }
}

function authenticateUser(username, password) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(USER_SHEET_NAME);
    if (!sheet) throw new Error(`Sheet "${USER_SHEET_NAME}" not found.`);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === username && data[i][1].toString() === password.toString()) {
        const initData = getInitializationData(username);
        return { status: 'success', initData: initData };
      }
    }
    return { status: 'error', message: 'Invalid username or password.' };
  } catch (e) {
    Logger.log(`Error in authenticateUser: ${e.toString()}`);
    return { status: 'error', message: 'Authentication error: ' + e.message };
  }
}

// --- Form Initialization ---

function getInitializationData(fullUsername) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const readingsSheet = ss.getSheetByName(READINGS_SHEET_NAME);
    const readingsData = readingsSheet.getDataRange().getValues();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let morningExists = false, eveningExists = false;
    let morningReading = null, eveningReading = null;

    // Check for today's entries
    for (let i = readingsData.length - 1; i > 0; i--) {
      const entryDate = new Date(readingsData[i][1]); // Column B
      entryDate.setHours(0, 0, 0, 0);
      const entryUser = readingsData[i][4]; // Column E
      
      if (entryUser === fullUsername && entryDate.getTime() === today.getTime()) {
        const timeType = readingsData[i][3]; // Column D
        if (timeType === 'Morning') {
          morningExists = true;
          morningReading = readingsData[i][6]; // Column G
        }
        if (timeType === 'Evening') {
          eveningExists = true;
          eveningReading = readingsData[i][7]; // Column H
        }
      }
      if (morningExists && eveningExists) break;
    }

    // Get summaries
    const monthlySummary = getMonthlySummary(fullUsername, readingsData);
    const weeklyTotal = getWeeklySummary(fullUsername, readingsData);

    return {
      status: 'success',
      entryState: { morningExists, eveningExists },
      readings: { morning: morningReading, evening: eveningReading },
      monthlySummary: monthlySummary,
      weeklyTotal: weeklyTotal
    };
  } catch (e) {
    Logger.log(`Error in getInitializationData: ${e.toString()}`);
    return { status: 'error', message: 'Initialization error: ' + e.message };
  }
}

// --- Weekly Summary Function ---
function getWeeklySummary(fullUsername, readingsData) {
    const now = new Date();
    const today = now.getDay(); // 0=Sunday, 1=Monday, ...
    const startOfWeek = new Date(now.setDate(now.getDate() - today));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const weeklyDateWiseSummary = {};

    for (let i = 1; i < readingsData.length; i++) {
        const row = readingsData[i];
        const entryUser = row[4]; // Column E
        if (entryUser === fullUsername) {
            const entryDate = new Date(row[1]); // Column B
            if (entryDate >= startOfWeek && entryDate <= endOfWeek) {
                const formattedDate = Utilities.formatDate(entryDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
                if (!weeklyDateWiseSummary[formattedDate]) {
                    weeklyDateWiseSummary[formattedDate] = { morning: null, evening: null };
                }
                if (row[3] === 'Morning' && !isNaN(parseFloat(row[6]))) weeklyDateWiseSummary[formattedDate].morning = parseFloat(row[6]);
                if (row[3] === 'Evening' && !isNaN(parseFloat(row[7]))) weeklyDateWiseSummary[formattedDate].evening = parseFloat(row[7]);
            }
        }
    }

    let weeklyTotalReading = 0;
    for (const date in weeklyDateWiseSummary) {
        const dailyReadings = weeklyDateWiseSummary[date];
        if (dailyReadings.morning !== null && dailyReadings.evening !== null) {
            weeklyTotalReading += (dailyReadings.evening - dailyReadings.morning);
        }
    }
    return weeklyTotalReading;
}


// --- Monthly Summary Function (UPDATED) ---
function getMonthlySummary(fullUsername, readingsData) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = now.toLocaleString('default', { month: 'long' });

  const dateWiseSummary = {};

  if (!readingsData) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const readingsSheet = ss.getSheetByName(READINGS_SHEET_NAME);
    readingsData = readingsSheet.getDataRange().getValues();
  }

  for (let i = 1; i < readingsData.length; i++) {
    const row = readingsData[i];
    const entryUser = row[4]; // Column E
    
    if (entryUser === fullUsername) {
      const entryDate = new Date(row[1]); // Column B
      if (entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear) {
        const formattedDate = Utilities.formatDate(entryDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
        
        if (!dateWiseSummary[formattedDate]) {
          dateWiseSummary[formattedDate] = { morning: null, evening: null };
        }

        const morningReading = parseFloat(row[6]); // Column G
        const eveningReading = parseFloat(row[7]); // Column H

        if (!isNaN(morningReading)) dateWiseSummary[formattedDate].morning = morningReading;
        if (!isNaN(eveningReading)) dateWiseSummary[formattedDate].evening = eveningReading;
      }
    }
  }
  
  // MODIFIED: Calculate total only from days with both readings
  let totalReading = 0;
  for(const date in dateWiseSummary){
    const daily = dateWiseSummary[date];
    if(daily.morning !== null && daily.evening !== null) {
        totalReading += (daily.evening - daily.morning);
    }
  }
  
  const sortedSummary = Object.entries(dateWiseSummary)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

  return {
    monthName: monthName,
    totalReading: totalReading.toFixed(2),
    dateWiseSummary: sortedSummary
  };
}


// --- OPTIMIZED: Single function for submission ---
function processSubmission(formObject, imageFile) {
  try {
    // 1. Upload Picture (with fallback for Google Drive limits)
    let pictureUrl = "No Picture Uploaded";
    try {
      if (imageFile && imageFile.data) {
        const decodedData = Utilities.base64Decode(imageFile.data);
        const mimeType = imageFile.type || 'image/jpeg';
        const fileName = imageFile.name || 'odometer.jpg';
        const blob = Utilities.newBlob(decodedData, mimeType, fileName);
        const folder = DriveApp.getFolderById(FOLDER_ID);
        const file = folder.createFile(blob);
        pictureUrl = file.getUrl();
      }
    } catch (uploadError) {
      Logger.log("Google Drive Upload Error: " + uploadError.toString());
      pictureUrl = "Error: Limit Exceeded/Drive Full";
    }

    // 2. Submit Reading
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(READINGS_SHEET_NAME);
    const now = new Date();
    
    const { bikeNumber } = parseUsername(formObject.fullUsername);

    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");
    const readingDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MMM-yyyy");
    const userEmail = "API User"; // Replaced Session.getActiveUser() as it doesn't work externally

    const morningReading = formObject.timeType === 'Morning' ? formObject.reading : '';
    const eveningReading = formObject.timeType === 'Evening' ? formObject.reading : '';

    const newRow = [
      timestamp, readingDate, userEmail, formObject.timeType,
      formObject.fullUsername, bikeNumber, morningReading, eveningReading,
      pictureUrl, formObject.location
    ];
    
    sheet.appendRow(newRow);
    
    // 3. Get updated data in the same run
    const updatedData = getInitializationData(formObject.fullUsername);
    updatedData.message = 'Reading submitted successfully!'; // Add success message to the response

    return updatedData;

  } catch (e) {
    Logger.log(`Error in processSubmission: ${e.toString()}`);
    return { status: 'error', message: 'Submission failed: ' + e.message };
  }
}

// --- Location Helper ---

function reverseGeocode(lat, lon) {
  try {
    if (lat && lon) {
      const response = Maps.newGeocoder().reverseGeocode(lat, lon);
      if (response && response.results && response.results.length > 0) {
        return response.results[0].formatted_address;
      }
    }
    return "Could not find address for location.";
  } catch (e) {
    Logger.log(`Error in reverseGeocode: ${e.toString()}`);
    return "Error fetching address: " + e.message;
  }
}
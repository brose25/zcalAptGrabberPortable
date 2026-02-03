// ==UserScript==
// @name         Zcal apts Grabber
// @namespace    http://tampermonkey.net/
// @version      4.5.3
// @description  Automatically find and open all appointments for today on zcal.co
// @author       Bro Sir Edward 25
// @match        https://zcal.co/events*
// @match        https://zcal.co/home*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Get today's date in the format used by the site (e.g., "Thu, Jan 29")
    function getTodayDateString() {
        const today = new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const dayName = days[today.getDay()];
        const monthName = months[today.getMonth()];
        const day = today.getDate();

        return `${dayName}, ${monthName} ${day}`;
    }

    // Show notification toast
    function showNotification(message, type = 'info') {
        // Remove existing notification if any
        const existing = document.getElementById('appointment-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.id = 'appointment-notification';

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };

        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10001;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            font-size: 14px;
            font-weight: 500;
            max-width: 350px;
            animation: slideIn 0.3s ease;
        `;

        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 4000);

        // Add CSS animations
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Convert a Date object to the format used by the site
    function formatDateForSite(date) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const dayName = days[date.getDay()];
        const monthName = months[date.getMonth()];
        const day = date.getDate();

        return `${dayName}, ${monthName} ${day}`;
    }

    // Check if popups are allowed
    function checkPopupsEnabled() {
        // Try to open a test popup
        const testPopup = window.open('', '_blank', 'width=1,height=1');

        if (testPopup) {
            // Popups are enabled, close the test popup
            testPopup.close();
            return true;
        }

        return false;
    }

    // Show popup permission dialog
    function showPopupPermissionDialog(callback) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10002;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
            max-width: 500px;
            width: 90%;
            text-align: center;
        `;

        modal.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 20px;">🚫</div>
            <h2 style="margin: 0 0 15px 0; color: #333; font-size: 22px;">Popups Blocked</h2>
            <p style="margin: 0 0 25px 0; color: #666; font-size: 15px; line-height: 1.6;">
                This script needs to open multiple tabs to download appointment CSVs.
                <br><br>
                <strong>Please enable popups for this site, then click "Try Again".</strong>
            </p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="cancel-popup-btn" style="
                    padding: 12px 24px;
                    background: #f0f0f0;
                    color: #333;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                    font-weight: bold;
                ">Cancel</button>
                <button id="retry-popup-btn" style="
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                    font-weight: bold;
                ">Try Again</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById('cancel-popup-btn').onclick = () => {
            document.body.removeChild(overlay);
        };

        document.getElementById('retry-popup-btn').onclick = () => {
            document.body.removeChild(overlay);
            if (checkPopupsEnabled()) {
                callback();
            } else {
                showPopupPermissionDialog(callback);
            }
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        };
    }

    // Find and download CSVs for all appointments for a given date
    function openAppointmentsForDate(dateString) {
        console.log(`Searching for appointments on: ${dateString}`);

        // Find all <p> elements containing the date
        const dateElements = document.querySelectorAll('p.MuiTypography-body1');
        const matchingElements = Array.from(dateElements).filter(elem => {
            const text = elem.textContent.trim();
            // Use regex to match exact date with word boundary to avoid "Feb 2" matching "Feb 23"
            const escapedDate = dateString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`\\b${escapedDate}\\b`);
            return pattern.test(text);
        });

        console.log(`Found ${matchingElements.length} appointment(s) for ${dateString}`);

        if (matchingElements.length === 0) {
            showNotification(`No appointments found for ${dateString}`, 'warning');
            return;
        }

        // Check if popups are enabled before proceeding
        if (!checkPopupsEnabled()) {
            showPopupPermissionDialog(() => {
                openAppointmentsForDate(dateString);
            });
            return;
        }

        // Collect all links first
        const eventLinks = [];
        matchingElements.forEach((elem, index) => {
            // Navigate up to the card root
            const card = elem.closest('.MuiCard-root');
            if (card) {
                // Find the "View event details" link
                const viewLink = card.querySelector('a[aria-label="View event details"]');
                if (viewLink) {
                    const href = viewLink.getAttribute('href');
                    const fullUrl = href.startsWith('http') ? href : `https://zcal.co${href}`;
                    eventLinks.push(fullUrl);
                }
            }
        });

        if (eventLinks.length === 0) {
            showNotification('Could not find any appointment links', 'error');
            return;
        }

        showNotification(`Processing ${eventLinks.length} appointment(s)...`, 'info');
        processAppointments(eventLinks, 0, dateString);
    }

    // Process appointments one by one by opening actual tabs
    function processAppointments(eventLinks, currentIndex, dateString) {
        if (currentIndex >= eventLinks.length) {
            console.log('=== ALL APPOINTMENTS PROCESSED ===');
            showNotification(`✓ Opened all ${eventLinks.length} appointment(s) for ${dateString}`, 'success');
            return;
        }

        const link = eventLinks[currentIndex];
        console.log(`\n=== OPENING APPOINTMENT ${currentIndex + 1}/${eventLinks.length} ===`);
        console.log(`URL: ${link}`);

        // Update notification
        showNotification(`Opening ${currentIndex + 1}/${eventLinks.length}... (Click download in each tab)`, 'info');

        // Open in new tab
        console.log('Opening new tab...');
        const newTab = window.open(link, '_blank');

        if (!newTab) {
            console.error('✗ Popup blocked! Please allow popups for this site.');
            showNotification('Popup blocked! Please allow popups and try again.', 'error');
            return;
        }

        console.log('✓ Tab opened successfully');

        // Wait before opening next tab to avoid popup blocker
        setTimeout(() => {
            processAppointments(eventLinks, currentIndex + 1, dateString);
        }, 2000); // 2 second delay between tabs
    }

    // Find and open all appointments for today
    function openTodayAppointments() {
        const dateString = getTodayDateString();
        openAppointmentsForDate(dateString);
    }

    // Show date picker and open appointments for selected date
    function openCustomDateAppointments() {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
        `;

        modal.innerHTML = `
            <h2 style="margin: 0 0 20px 0; color: #333; font-size: 20px;">Select Date</h2>
            <input type="date" id="custom-date-picker" style="
                width: 100%;
                padding: 12px;
                font-size: 16px;
                border: 2px solid #ddd;
                border-radius: 6px;
                margin-bottom: 20px;
                box-sizing: border-box;
            " />
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancel-date-btn" style="
                    padding: 10px 20px;
                    background: #f0f0f0;
                    color: #333;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                    font-weight: bold;
                ">Cancel</button>
                <button id="confirm-date-btn" style="
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                    font-weight: bold;
                ">Open Appointments</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Set default date to today
        const dateInput = document.getElementById('custom-date-picker');
        const today = new Date();
        dateInput.value = today.toISOString().split('T')[0];
        dateInput.focus();

        // Cancel button
        document.getElementById('cancel-date-btn').onclick = () => {
            document.body.removeChild(overlay);
        };

        // Confirm button
        document.getElementById('confirm-date-btn').onclick = () => {
            const selectedDate = new Date(dateInput.value + 'T00:00:00');
            const dateString = formatDateForSite(selectedDate);
            document.body.removeChild(overlay);
            openAppointmentsForDate(dateString);
        };

        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        };

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    // Create a button to trigger the script
    function createButton() {
        // Wait for the page to load
        const checkExist = setInterval(() => {
            const container = document.querySelector('.MuiContainer-root');
            if (container) {
                clearInterval(checkExist);

                // Check if button already exists
                if (document.getElementById('open-today-btn')) {
                    return;
                }

                // Create button container
                const buttonContainer = document.createElement('div');
                buttonContainer.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                `;

                // Create "Today" button
                const todayButton = document.createElement('button');
                todayButton.id = 'open-today-btn';
                todayButton.textContent = "📅 Open Today's Appointments";
                todayButton.style.cssText = `
                    padding: 12px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s ease;
                `;

                // Create "Custom Date" button
                const customButton = document.createElement('button');
                customButton.id = 'open-custom-btn';
                customButton.textContent = "🗓️ Pick Date";
                customButton.style.cssText = `
                    padding: 12px 20px;
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s ease;
                `;

                // Create drag-and-drop zone for combining CSVs
                const dropZone = document.createElement('div');
                dropZone.id = 'csv-drop-zone';
                dropZone.innerHTML = `
                    <div style="text-align: center; padding: 5px;">
                        <div style="font-size: 24px; margin-bottom: 5px;">📂</div>
                        <div style="font-size: 12px; font-weight: bold;">Drag CSVs Here</div>
                        <div style="font-size: 10px; opacity: 0.8; margin-top: 3px;">to combine</div>
                    </div>
                `;
                dropZone.style.cssText = `
                    padding: 15px;
                    background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
                    color: #333;
                    border: 2px dashed #999;
                    border-radius: 8px;
                    font-size: 13px;
                    cursor: pointer;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s ease;
                `;

                // Hover effects for buttons
                [todayButton, customButton].forEach(btn => {
                    btn.onmouseover = () => {
                        btn.style.transform = 'translateY(-2px)';
                        btn.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
                    };
                    btn.onmouseout = () => {
                        btn.style.transform = 'translateY(0)';
                        btn.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                    };
                });

                // Drag and drop event handlers
                dropZone.ondragover = (e) => {
                    e.preventDefault();
                    dropZone.style.background = 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)';
                    dropZone.style.borderColor = '#667eea';
                    dropZone.style.transform = 'scale(1.02)';
                };

                dropZone.ondragleave = () => {
                    dropZone.style.background = 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)';
                    dropZone.style.borderColor = '#999';
                    dropZone.style.transform = 'scale(1)';
                };

                dropZone.ondrop = (e) => {
                    e.preventDefault();
                    dropZone.style.background = 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)';
                    dropZone.style.borderColor = '#999';
                    dropZone.style.transform = 'scale(1)';

                    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
                    if (files.length > 0) {
                        combineCSVFiles(files);
                    } else {
                        showNotification('Please drop CSV files only', 'warning');
                    }
                };

                // Click handlers
                todayButton.onclick = openTodayAppointments;
                customButton.onclick = openCustomDateAppointments;

                // Add buttons to container
                buttonContainer.appendChild(todayButton);
                buttonContainer.appendChild(customButton);
                buttonContainer.appendChild(dropZone);

                // Add to page
                document.body.appendChild(buttonContainer);
            }
        }, 100);
    }

    // Combine multiple CSV files
    function combineCSVFiles(files) {
        if (files.length === 0) {
            showNotification('No files selected', 'warning');
            return;
        }

        // Show confirmation dialog
        showCombineConfirmationDialog(files);
    }

    // Show confirmation dialog before combining
    function showCombineConfirmationDialog(files) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10002;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
            max-width: 500px;
            width: 90%;
            text-align: center;
        `;

        const fileList = files.map(f => `<li style="text-align: left; margin: 5px 0;">${f.name}</li>`).join('');

        modal.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 20px;">📋</div>
            <h2 style="margin: 0 0 15px 0; color: #333; font-size: 22px;">Combine ${files.length} CSV File(s)?</h2>
            <div style="margin: 0 0 25px 0; color: #666; font-size: 14px; line-height: 1.6; text-align: left;">
                <p style="margin: 0 0 10px 0; text-align: center;"><strong>Files to combine:</strong></p>
                <ul style="max-height: 200px; overflow-y: auto; padding-left: 20px; margin: 0 0 15px 0;">
                    ${fileList}
                </ul>
                <p style="margin: 0; text-align: center; font-size: 13px; opacity: 0.8;">
                    This will merge all files and remove 'name', 'email', and 'eventEndDate' columns.
                </p>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="cancel-combine-btn" style="
                    padding: 12px 24px;
                    background: #f0f0f0;
                    color: #333;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                    font-weight: bold;
                ">Cancel</button>
                <button id="confirm-combine-btn" style="
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                    font-weight: bold;
                ">Continue</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById('cancel-combine-btn').onclick = () => {
            document.body.removeChild(overlay);
            showNotification('Combine cancelled', 'info');
        };

        document.getElementById('confirm-combine-btn').onclick = () => {
            document.body.removeChild(overlay);
            processCombineFiles(files);
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                showNotification('Combine cancelled', 'info');
            }
        };
    }

    // Process combining files after confirmation
    function processCombineFiles(files) {
        showNotification(`Combining ${files.length} CSV file(s)...`, 'info');
        console.log(`Combining ${files.length} CSV files`);

        let completedReads = 0;
        const fileContents = [];

        files.forEach((file, index) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const content = e.target.result;
                fileContents[index] = content.split('\n');
                completedReads++;

                console.log(`Read file ${completedReads}/${files.length}: ${file.name} (${fileContents[index].length} lines)`);

                // When all files are read, combine them
                if (completedReads === files.length) {
                    processCombinedCSV(fileContents, files);
                }
            };

            reader.onerror = () => {
                showNotification(`Error reading ${file.name}`, 'error');
                console.error(`Error reading file: ${file.name}`);
            };

            reader.readAsText(file);
        });
    }

    // Process and download combined CSV
    function processCombinedCSV(fileContents, originalFiles) {
        let combinedLines = [];
        let header = null;
        let totalDataRows = 0;

        fileContents.forEach((lines, index) => {
            if (lines.length === 0) {
                console.log(`Skipping empty file: ${originalFiles[index].name}`);
                return;
            }

            // First file: keep header
            if (index === 0) {
                header = lines[0];
                combinedLines.push(header);

                // Add data rows (skip header and empty lines)
                const dataRows = lines.slice(1).filter(line => line.trim() !== '');
                combinedLines.push(...dataRows);
                totalDataRows += dataRows.length;
            } else {
                // Subsequent files: skip header, only add data
                const dataRows = lines.slice(1).filter(line => line.trim() !== '');
                combinedLines.push(...dataRows);
                totalDataRows += dataRows.length;
            }
        });

        // Parse CSV and remove specified columns
        const parsedData = parseCSV(combinedLines);
        const processedData = removeColumnsAndTransform(parsedData);
        const combinedCSV = unparseCSV(processedData);

        // Generate filename with readable date
        const now = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dateStr = `${monthNames[now.getMonth()]}-${now.getDate()}-${now.getFullYear()}`;
        const filename = `appointments_${dateStr}.csv`;

        // Create blob and download
        const blob = new Blob([combinedCSV], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log(`✓ Combined ${fileContents.length} files`);
        console.log(`  Total data rows: ${totalDataRows}`);
        console.log(`  Downloaded as: ${filename}`);

        showNotification(`✓ Combined ${fileContents.length} file(s) with ${totalDataRows} rows`, 'success');
    }

    // Parse CSV into array of objects
    function parseCSV(lines) {
        if (lines.length === 0) return [];

        const result = [];
        const headers = parseCSVLine(lines[0]);

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;

            const values = parseCSVLine(lines[i]);
            const row = {};

            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });

            result.push(row);
        }

        return result;
    }

    // Parse a single CSV line (handles quoted fields with commas)
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // Field separator
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        // Add last field
        result.push(current);

        return result;
    }

    // Remove columns and transform data
    function removeColumnsAndTransform(data) {
        if (data.length === 0) return data;

        const columnsToRemove = ['name', 'email', 'eventEndDate'];

        const transformedData = data.map(row => {
            const newRow = {};

            for (const [key, value] of Object.entries(row)) {
                // Skip columns to remove
                if (columnsToRemove.includes(key)) {
                    continue;
                }

                // Transform eventStartDate to keep only time
                if (key === 'eventStartDate') {
                    newRow[key] = extractTime(value);
                } else {
                    newRow[key] = value;
                }
            }

            return newRow;
        });

        // Sort by time (eventStartDate) in chronological order
        return transformedData.sort((a, b) => {
            return compareTime(a.eventStartDate, b.eventStartDate);
        });
    }

    // Compare two time strings (e.g., "10:30 AM" vs "2:15 PM")
    function compareTime(timeA, timeB) {
        if (!timeA && !timeB) return 0;
        if (!timeA) return 1;
        if (!timeB) return -1;

        const parseTime = (timeStr) => {
            const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
            if (!match) return 0;

            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const period = (match[3] || '').toUpperCase();

            // Convert to 24-hour format
            if (period === 'PM' && hours !== 12) {
                hours += 12;
            } else if (period === 'AM' && hours === 12) {
                hours = 0;
            }

            return hours * 60 + minutes; // Return total minutes
        };

        return parseTime(timeA) - parseTime(timeB);
    }

    // Extract time from datetime string (e.g., "02/02/2026 10:30 AM" -> "10:30 AM")
    function extractTime(dateTimeString) {
        if (!dateTimeString) return '';

        // Match pattern: date (mm/dd/yyyy or similar) followed by time
        // Try to find the time portion (HH:MM AM/PM or HH:MM)
        const timeMatch = dateTimeString.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/);

        if (timeMatch) {
            return timeMatch[1].trim();
        }

        // If no match, return original
        return dateTimeString;
    }

    // Convert array of objects back to CSV string (without header)
    function unparseCSV(data) {
        if (data.length === 0) return '';

        // Get headers from first row
        const headers = Object.keys(data[0]);

        // Build CSV without header row
        const lines = [];

        data.forEach(row => {
            const values = headers.map(header => escapeCSVField(row[header] || ''));
            lines.push(values.join(','));
        });

        return lines.join('\n');
    }

    // Escape a CSV field (add quotes if needed)
    function escapeCSVField(field) {
        const stringField = String(field);

        // If field contains comma, quote, or newline, wrap in quotes and escape quotes
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return '"' + stringField.replace(/"/g, '""') + '"';
        }

        return stringField;
    }

    // Auto-download functionality for event detail pages
    function autoDownloadCSV() {
        // Check if we're on an event detail page (URL pattern: /events/xxxxx)
        const urlPattern = /\/events\/[a-zA-Z0-9]+$/;
        if (!urlPattern.test(window.location.pathname)) {
            return; // Not on an event detail page
        }

        console.log('=== AUTO-DOWNLOAD ACTIVATED ===');
        console.log('Event detail page detected, searching for download button...');

        // Function to find and click the download button
        function findAndClickDownload() {
            // Look for buttons or links containing "download" or "csv" text
            const allButtons = document.querySelectorAll('button, a');

            for (const button of allButtons) {
                const text = button.textContent.toLowerCase();
                const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();

                if (text.includes('download') && text.includes('csv') ||
                    ariaLabel.includes('download') && ariaLabel.includes('csv')) {
                    console.log('✓ Found download button:', button.textContent.trim());
                    console.log('Clicking download button...');
                    button.click();
                    console.log('✓ Download initiated!');

                    // Close tab after a short delay
                    setTimeout(() => {
                        console.log('Closing tab...');
                        window.close();
                    }, 1500);

                    return true;
                }
            }

            console.log('Download button not found yet, will retry...');
            return false;
        }

        // Try immediately first
        if (findAndClickDownload()) {
            return;
        }

        // If not found, wait for React to render and try again
        let attempts = 0;
        const maxAttempts = 10;

        const interval = setInterval(() => {
            attempts++;
            console.log(`Retry attempt ${attempts}/${maxAttempts}...`);

            if (findAndClickDownload()) {
                clearInterval(interval);
            } else if (attempts >= maxAttempts) {
                console.error('✗ Could not find download button after 10 attempts');
                clearInterval(interval);

                // Show notification that manual download is needed
                showNotification('Could not auto-download. Please click download manually.', 'warning');
            }
        }, 500); // Check every 500ms
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createButton();
            autoDownloadCSV();
        });
    } else {
        createButton();
        autoDownloadCSV();
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+T for today's appointments
        if (e.ctrlKey && e.shiftKey && e.key === 'T') {
            e.preventDefault();
            openTodayAppointments();
        }
        // Ctrl+Shift+D for custom date picker
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            openCustomDateAppointments();
        }
    });

})();

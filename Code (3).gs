// ══════════════════════════════════════════════════════════
// PER4MANCE GURU — SCHOOL ADMISSION FORM
// ══════════════════════════════════════════════════════════

var CONFIG = {
  EMAIL_TO:   "hello@per4mance.guru",
  SHEET_NAME: "School Admission Leads",
  SHEET_ID:   "1MrOp1-XhsgTGqyq0BJ1IMZ3SPO_P59AUg2AeLpVnMN0",
};

// ── Handles GET requests (from iframe) ──
function doGet(e) {
  try {
    var raw  = e.parameter.data;
    var data = JSON.parse(decodeURIComponent(raw));
    saveToSheet(data);
    sendEmail(data);
    return ContentService
      .createTextOutput("OK")
      .setMimeType(ContentService.MimeType.TEXT);
  } catch(err) {
    return ContentService
      .createTextOutput("Error: " + err.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

// ── Handles POST requests (fallback) ──
function doPost(e) {
  try {
    var raw = e.postData.contents;
    var data;
    try { data = JSON.parse(raw); }
    catch(ex) {
      var params = {};
      raw.split('&').forEach(function(pair) {
        var p = pair.split('=');
        if(p.length === 2) params[decodeURIComponent(p[0])] = decodeURIComponent(p[1].replace(/\+/g,' '));
      });
      data = params.data ? JSON.parse(params.data) : params;
    }
    saveToSheet(data);
    sendEmail(data);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Save to Sheet ──
function saveToSheet(data) {
  var ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    var headers = [
      "Sr. No.","Date & Time","Full Name","Phone","Email",
      "School Role","School Name","School Location","Student Enrollment",
      "Current Marketing","Interested Services","Monthly Budget",
      "Start Timeline","UTM Source","UTM Medium","UTM Campaign",
      "Landing URL","Lead Quality"
    ];
    sheet.appendRow(headers);
    var hr = sheet.getRange(1,1,1,headers.length);
    hr.setBackground("#0a0a0a"); hr.setFontColor("#ffffff");
    hr.setFontWeight("bold"); hr.setFontSize(11);
    sheet.setFrozenRows(1);
    [60,160,150,130,180,140,180,160,130,150,200,130,130,120,120,140,200,120]
      .forEach(function(w,i){ sheet.setColumnWidth(i+1,w); });
  }

  var quality = "Normal";
  if      (data.budget==="1l+"||data.budget==="80-1l") quality="High Intent";
  else if (data.timeline==="Immediately")              quality="Hot Lead";
  else if (data.budget==="50-80k")                     quality="Warm Lead";

  var row = [
    sheet.getLastRow(),
    Utilities.formatDate(new Date(),"Asia/Kolkata","dd/MM/yyyy HH:mm:ss"),
    data.fullName||"", data.phone||"", data.email||"",
    data.role||"", data.schoolName||"", data.schoolLocation||"",
    data.enrollment||"", data.currentMarketing||"",
    Array.isArray(data.interestedServices)
      ? data.interestedServices.join(", ") : (data.interestedServices||""),
    data.budget||"", data.timeline||"",
    data.utmSource||"Direct", data.utmMedium||"", data.utmCampaign||"",
    data.landingUrl||"", quality
  ];

  sheet.appendRow(row);

  var r = sheet.getRange(sheet.getLastRow(),1,1,row.length);
  r.setFontSize(10); r.setVerticalAlignment("middle");
  if      (quality==="High Intent") r.setBackground("#fff3cd");
  else if (quality==="Hot Lead")    r.setBackground("#fde8e8");
  else if (quality==="Warm Lead")   r.setBackground("#e8f5e9");
}

// ── Send Email ──
function sendEmail(data) {
  var services = Array.isArray(data.interestedServices)
    ? data.interestedServices.join(", ") : (data.interestedServices||"Not specified");

  var badge="Normal Lead", bc="#6c757d";
  if      (data.budget==="1l+"||data.budget==="80-1l"){ badge="HIGH INTENT LEAD"; bc="#dc3545"; }
  else if (data.timeline==="Immediately")              { badge="HOT LEAD";         bc="#fd7e14"; }
  else if (data.budget==="50-80k")                     { badge="WARM LEAD";        bc="#28a745"; }

  var subject = "New School Lead: "+(data.schoolName||data.fullName)+" — "+(data.schoolLocation||"")+" ["+badge+"]";
  var sheetLink = "https://docs.google.com/spreadsheets/d/"+CONFIG.SHEET_ID;

  var html =
    '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto">'+
    '<div style="background:#0a0a0a;padding:24px 32px;text-align:center">'+
    '<h1 style="color:#fff;margin:0;font-size:22px">Per4mance <span style="color:#E8543A">Guru</span></h1>'+
    '<p style="color:#aaa;margin:6px 0 0;font-size:13px">New School Admission Lead</p></div>'+
    '<div style="background:'+bc+';padding:12px 32px;text-align:center">'+
    '<p style="color:#fff;margin:0;font-size:15px;font-weight:bold">'+badge+'</p></div>'+
    '<div style="background:#fff;padding:32px">'+
    '<h2 style="font-size:16px;border-bottom:2px solid #E8543A;padding-bottom:8px;margin-top:0;color:#000">Contact Details</h2>'+
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">'+
    eRow("Full Name",data.fullName)+
    eRow("Phone",'<a href="tel:'+data.phone+'" style="color:#E8543A;font-weight:bold">'+data.phone+'</a>')+
    eRow("Email",data.email?'<a href="mailto:'+data.email+'" style="color:#E8543A">'+data.email+'</a>':"Not provided")+
    '</table>'+
    '<h2 style="font-size:16px;border-bottom:2px solid #E8543A;padding-bottom:8px;color:#000">School Details</h2>'+
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">'+
    eRow("Role",data.role)+eRow("School","<strong>"+(data.schoolName||"")+"</strong>")+
    eRow("Location",data.schoolLocation)+eRow("Enrollment",data.enrollment)+
    '</table>'+
    '<h2 style="font-size:16px;border-bottom:2px solid #E8543A;padding-bottom:8px;color:#000">Marketing Details</h2>'+
    '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">'+
    eRow("Current Marketing",data.currentMarketing)+eRow("Interested In",services)+
    eRow("Monthly Budget",data.budget)+
    eRow("Start Timeline","<strong style=\"color:#E8543A\">"+(data.timeline||"")+"</strong>")+
    '</table>'+
    '<div style="text-align:center;margin:20px 0;display:flex;gap:12px;justify-content:center">'+
    '<a href="'+sheetLink+'" style="background:#0a0a0a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">View Sheet</a>'+
    '<a href="tel:'+data.phone+'" style="background:#E8543A;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Call Now</a>'+
    '</div></div>'+
    '<div style="background:#0a0a0a;padding:16px;text-align:center">'+
    '<p style="color:#666;margin:0;font-size:12px">Per4mance Guru | hello@per4mance.guru | +91 98110 96907</p></div></div>';

  GmailApp.sendEmail(CONFIG.EMAIL_TO, subject,
    "Lead: "+data.fullName+" | "+data.phone+" | "+data.schoolName+" | "+data.budget+" | "+data.timeline,
    { htmlBody:html, name:"Per4mance Guru — Lead Alert" });
}

function eRow(l,v){
  return '<tr><td style="padding:8px 12px;background:#f8f9fa;width:35%;font-size:13px;color:#666;font-weight:bold;border-bottom:1px solid #eee">'+l+'</td>'+
         '<td style="padding:8px 12px;font-size:13px;color:#333;border-bottom:1px solid #eee">'+(v||"—")+'</td></tr>';
}

// ── Test ──
function testForm() {
  var d = {
    fullName:"Test Lead",phone:"9810000000",email:"test@school.com",
    role:"Principal",schoolName:"DPS Gurgaon",schoolLocation:"Gurgaon",
    enrollment:"500-1000",currentMarketing:"No",
    interestedServices:["SEO","Google Ads"],
    budget:"1l+",timeline:"Immediately",
    utmSource:"facebook",utmCampaign:"test",
    landingUrl:"https://per4mance.guru/school-admission-marketing"
  };
  saveToSheet(d);
  sendEmail(d);
  Logger.log("Done.");
}

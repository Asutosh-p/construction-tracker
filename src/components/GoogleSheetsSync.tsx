import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Sheet, Download, Upload, TestTube, Copy, CheckCircle2, AlertCircle } from 'lucide-react'

const APPS_SCRIPT = `function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var response = { sheets: {} };

  // Read Data sheet (single sheet with full hierarchy)
  var dSheet = ss.getSheetByName('Data') || ss.insertSheet('Data');
  var dData = dSheet.getDataRange().getValues();
  if (dData.length > 1) {
    response.sheets.data = dData.slice(1).map(function(row) {
      return {
        building: row[0] || '', floor: row[1] || '', room: row[2] || '',
        code: row[3] || '', name: row[4] || '', type: row[5] || '',
        status: row[6] || '', percent: Number(row[7]) || 0, notes: row[8] || ''
      };
    });
  }

  // Also read individual sheets for backward compat
  var bSheet = ss.getSheetByName('Buildings');
  if (bSheet) {
    var bData = bSheet.getDataRange().getValues();
    if (bData.length > 1) {
      response.sheets.buildings = bData.slice(1).map(function(row) {
        return { id: row[0] || '', name: row[1] || '', type: row[2] || '' };
      });
    }
  }

  var fSheet = ss.getSheetByName('Floors');
  if (fSheet) {
    var fData = fSheet.getDataRange().getValues();
    if (fData.length > 1) {
      response.sheets.floors = fData.slice(1).map(function(row) {
        return { id: row[0] || '', name: row[1] || '', building: row[2] || '' };
      });
    }
  }

  var iSheet = ss.getSheetByName('Items');
  if (iSheet) {
    var iData = iSheet.getDataRange().getValues();
    if (iData.length > 1) {
      response.sheets.items = iData.slice(1).map(function(row) {
        return {
          id: row[0] || '', code: row[1] || '', name: row[2] || '',
          status: row[3] || '', percent: Number(row[4]) || 0,
          floor: row[5] || '', building: row[6] || '', type: row[7] || ''
        };
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (body.action === 'export' && body.data) {
    // Write Buildings sheet
    var bSheet = ss.getSheetByName('Buildings') || ss.insertSheet('Buildings');
    bSheet.clear();
    bSheet.appendRow(['ID', 'Name', 'Type']);
    (body.data.buildings || []).forEach(function(b) { bSheet.appendRow([b.id, b.name, b.type]); });

    // Write Floors sheet
    var fSheet = ss.getSheetByName('Floors') || ss.insertSheet('Floors');
    fSheet.clear();
    fSheet.appendRow(['ID', 'Name', 'Building']);
    (body.data.floors || []).forEach(function(f) { fSheet.appendRow([f.id, f.name, f.building]); });

    // Write Rooms sheet
    var rSheet = ss.getSheetByName('Rooms') || ss.insertSheet('Rooms');
    rSheet.clear();
    rSheet.appendRow(['ID', 'Name', 'Floor', 'Building']);
    (body.data.rooms || []).forEach(function(r) { rSheet.appendRow([r.id, r.name, r.floor, r.building]); });

    // Write Items sheet
    var iSheet = ss.getSheetByName('Items') || ss.insertSheet('Items');
    iSheet.clear();
    iSheet.appendRow(['ID', 'Code', 'Name', 'Status', 'Percent', 'Floor', 'Building', 'Type', 'Room']);
    (body.data.items || []).forEach(function(i) {
      iSheet.appendRow([i.id, i.code, i.name, i.status, i.percent, i.floor, i.building, i.type, i.room || '']);
    });

    // Write ItemTypes sheet
    var tSheet = ss.getSheetByName('ItemTypes') || ss.insertSheet('ItemTypes');
    tSheet.clear();
    tSheet.appendRow(['ID', 'Code', 'Name', 'Description']);
    (body.data.itemTypes || []).forEach(function(t) { tSheet.appendRow([t.id, t.code, t.name, t.description]); });

    // Write Import sheet (single sheet for easy import)
    var impSheet = ss.getSheetByName('Import') || ss.insertSheet('Import');
    impSheet.clear();
    impSheet.appendRow(['Building', 'Floor', 'Room', 'Item Code', 'Item Name', 'Item Type', 'Status', 'Percent', 'Notes']);
    (body.data.items || []).forEach(function(i) {
      impSheet.appendRow([i.building, i.floor, i.room || '', i.code, i.name, i.type, i.status, i.percent, '']);
    });
    // Format header row
    var lastCol = impSheet.getLastColumn();
    impSheet.getRange(1, 1, 1, lastCol).setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
    impSheet.setFrozenRows(1);
    // Auto-resize columns
    for (var c = 1; c <= lastCol; c++) {
      impSheet.autoResizeColumn(c);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === 'import') {
    return doGet(e);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}`

export default function GoogleSheetsSync() {
  const [scriptUrl, setScriptUrl] = useState('')
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [showScript, setShowScript] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/sheets/config').then(r => r.json()).then(d => {
      if (d.scriptUrl) setScriptUrl(d.scriptUrl)
    }).catch(() => {})
  }, [])

  async function saveConfig() {
    await fetch('/api/sheets/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl })
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function testConnection() {
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch('/api/sheets/test')
      const data = await res.json()
      setTestResult({ ok: data.ok, message: data.ok ? 'Connected to Google Sheet!' : (data.error || 'Connection failed') })
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message })
    }
    setTesting(false)
  }

  async function exportToSheet() {
    setExporting(true); setExportResult(null)
    try {
      const res = await fetch('/api/sheets/export', { method: 'POST' })
      const data = await res.json()
      setExportResult(data.ok ? 'Data exported to Google Sheet!' : (data.error || 'Export failed'))
    } catch (err: any) {
      setExportResult(err.message)
    }
    setExporting(false)
  }

  async function importFromSheet() {
    setImporting(true); setImportResult(null)
    try {
      const res = await fetch('/api/sheets/import', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setImportResult('Imported! Buildings: ' + (data.imported?.buildings || 0) + ', Items: ' + (data.imported?.items || 0))
      } else {
        setImportResult(data.error || 'Import failed')
      }
    } catch (err: any) {
      setImportResult(err.message)
    }
    setImporting(false)
  }

  function copyScript() {
    navigator.clipboard.writeText(APPS_SCRIPT).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sheet className="h-5 w-5" /> Google Sheets Sync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Google Sheets URL</Label>
          <div className="flex gap-2">
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/XXXXX/edit"
              value={scriptUrl}
              onChange={e => setScriptUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={saveConfig} variant={saved ? "default" : "outline"}>
              {saved ? <CheckCircle2 className="h-4 w-4" /> : 'Save'}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Setup Instructions</Label>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Open your Google Sheet</li>
            <li>Go to <strong>Extensions - Apps Script</strong></li>
            <li>Delete any existing code and paste the script below</li>
            <li>Click <strong>Deploy - New Deployment - Web App</strong></li>
            <li>Set Execute as <strong>Me</strong>, Who has access <strong>Anyone</strong></li>
            <li>Click Deploy, copy the Web App URL, paste above</li>
          </ol>
          <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
            <p className="font-semibold text-blue-800 mb-1">Import Format (Import sheet)</p>
            <p className="text-blue-700">Columns: <strong>Building | Floor | Room | Item Code | Item Name | Item Type | Status | Percent | Notes</strong></p>
            <p className="text-blue-600 text-xs mt-1">Tip: Export first to see the format, then edit the Import sheet and import back. Items are matched by Item Code.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowScript(!showScript)} className="mt-2">
            <Copy className="h-4 w-4 mr-1" />
            {showScript ? 'Hide Export Script' : 'Setup Export (Apps Script)'}
          </Button>
          {showScript && (
            <div className="relative">
              <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-60 font-mono whitespace-pre-wrap">{APPS_SCRIPT}</pre>
              <Button size="sm" variant="secondary" className="absolute top-2 right-2" onClick={copyScript}>
                {copied ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={testConnection} disabled={testing || !scriptUrl}>
            <TestTube className="h-4 w-4 mr-1" />
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button variant="outline" onClick={exportToSheet} disabled={exporting || !scriptUrl}>
            <Upload className="h-4 w-4 mr-1" />
            {exporting ? 'Exporting...' : 'Export to Sheet'}
          </Button>
          <Button variant="outline" onClick={importFromSheet} disabled={importing || !scriptUrl}>
            <Download className="h-4 w-4 mr-1" />
            {importing ? 'Importing...' : 'Import from Sheet'}
          </Button>
        </div>

        {testResult && (
          <div className={"flex items-center gap-2 text-sm p-2 rounded " + (testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
            {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {testResult.message}
          </div>
        )}
        {exportResult && (
          <div className="text-sm p-2 rounded bg-blue-50 text-blue-700">{exportResult}</div>
        )}
        {importResult && (
          <div className="text-sm p-2 rounded bg-purple-50 text-purple-700">{importResult}</div>
        )}
      </CardContent>
    </Card>
  )
}

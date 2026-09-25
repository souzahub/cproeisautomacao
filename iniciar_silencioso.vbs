Set objFSO = CreateObject("Scripting.FileSystemObject")
strDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = strDir

strPy = "pythonw.exe"
strUserPy = objShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\Python\Python313\pythonw.exe"
If objFSO.FileExists(strUserPy) Then
    strPy = strUserPy
End If

objShell.Run """" & strPy & """ """ & strDir & "\agendador_local.py""", 0, False

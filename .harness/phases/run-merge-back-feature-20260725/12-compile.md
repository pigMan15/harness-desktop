# Compile

## Gate: G3_COMPILE

Status: PASS

## Evidence

```powershell
py -3 -m py_compile runtime\src\harness_runtime\runs\service.py runtime\src\harness_runtime\api\app.py
.\node_modules\.bin\tsc.CMD --project apps\desktop\tsconfig.json --noEmit
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Results: all exit code 0.


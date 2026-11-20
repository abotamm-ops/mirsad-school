# Schools2.9.57 — preserve the persisted control epoch when starting a new run

After stopping, switching school or logging out, mirsadAutoRun may be null while mirsadRunControlEpoch remains nonzero.56 initialized a new run from oldRun?.controlEpoch ??0. saveRun correctly rejected that new run against the persisted nonzero epoch, then the worker silently returned. The controller displayed the owner's exact “لم يبدأ محرك الرصد” message even with a valid timetable.

57 captures the persisted epoch at engine entry and uses it for the new run. It does not reset the epoch or weaken saveRun. A later stop still advances the epoch and rejects delayed work. commitRunControl now advances the epoch even when no run has been persisted, protecting a stop that arrives during initial startup.

Reproduction: the four real controller/scheduler/CloudMonitoring/worker table tests fail on56 after setting an existing control epoch and clearing the run. They pass on57. The suite now includes actual MirsadMulti checkpoint/clearLocal/restoreLogin with a replacement writer, retained nonzero epoch, previous source date, and a successfully opened check. A concurrent empty-run stop advances the epoch and prevents the delayed start while retaining saved attendance.

Validation:94 startup/controller/daily/native/protection/policy/client tests and54 video tests passed. Existing popup browser regression passed. The Windows user session has not been directly inspected; the defect and exact failure were reproduced in the actual worker under the stated state transition.

This is extension-only. Service53, website, attendance classification, timetable, archives, local evidence, personal edition and authentication policy remain unchanged. Update the same extension folder and Reload. Uninstalling, deleting data, changing Google deployment or signing out again is unnecessary.

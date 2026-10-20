(() => {
  const normalize = value => String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
  const asciiDigits = value => normalize(value).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

  function makeManualPeriods(startValue,durationValue=45,gapValue=0,countValue=7,delayValue=1) {
    const raw=asciiDigits(startValue),match=/^(\d{1,2}):(\d{2})$/.exec(raw);
    const hour=match?Number(match[1]):-1,minute=match?Number(match[2]):-1;
    const duration=Number(durationValue),gap=Number(gapValue),count=Number(countValue),delay=Number(delayValue);
    if(hour<0||hour>23||minute<0||minute>59||!Number.isInteger(duration)||duration<1||duration>180||!Number.isInteger(gap)||gap<0||gap>60||!Number.isInteger(count)||count<1||count>7||!Number.isInteger(delay)||delay<1||delay>10)return [];
    const first=hour*60+minute;
    return Array.from({length:count},(_,index)=>{
      const start=first+index*(duration+gap),end=start+duration,scan=start+delay;
      const clock=value=>String(Math.floor(value/60)%24).padStart(2,"0")+":"+String(value%60).padStart(2,"0");
      return {n:index+1,startOffset:start,endOffset:end,scanOffset:scan,start:clock(start),end:clock(end),scan:clock(scan)};
    });
  }

  function periodAtMinute(periods,minuteOfDay) {
    const minute=((Number(minuteOfDay)%1440)+1440)%1440;
    const active=(periods||[]).filter(period=>{
      const start=period.startOffset%1440,end=period.endOffset%1440;
      return start<end ? minute>=start&&minute<end : minute>=start||minute<end;
    });
    return active.length===1?active[0]:null;
  }

  function parseTimeRange(label) {
    const text = asciiDigits(label).replace(/[إأآ]/g, "ا").replace(/[٫]/g, ":");
    const match = text.match(/(\d{1,2}:\d{2})\s*([صم])?\s*[-–—至]\s*(\d{1,2}:\d{2})\s*([صم])?/);
    if (!match) return null;
    const parse = (clock, suffix) => {
      let [hour, minute] = clock.split(":").map(Number);
      if (minute > 59 || hour > 23) return null;
      if (suffix) {
        if (hour < 1 || hour > 12) return null;
        hour = suffix === "ص" ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12);
      }
      return hour * 60 + minute;
    };
    const hasStartSuffix = Boolean(match[2]);
    const hasEndSuffix = Boolean(match[4]);
    const start = parse(match[1], match[2]);
    if (start === null) return null;
    let end = parse(match[3], match[4] || match[2]);
    if (end === null) return null;
    // School tables commonly put ص/م once at the end of the whole range.
    // If only the end has a suffix, try both interpretations of the start
    // and accept the unique short (<= 3h) forward range.
    if (!hasStartSuffix && hasEndSuffix) {
      const sameSuffixStart = parse(match[1], match[4]);
      const candidates = [start, sameSuffixStart].filter(Number.isFinite).map(candidateStart => {
        let candidateEnd = end;
        if (candidateEnd <= candidateStart) candidateEnd += 1440;
        return { start: candidateStart, end: candidateEnd };
      }).filter(range => range.end > range.start && range.end - range.start <= 180);
      if (!candidates.length) return null;
      candidates.sort((a, b) => (a.end - a.start) - (b.end - b.start));
      if (candidates.length > 1 && candidates[0].end - candidates[0].start === candidates[1].end - candidates[1].start && candidates[0].start !== candidates[1].start) return null;
      return candidates[0];
    }
    // When only the start has a suffix, apply it to the end and roll noon or
    // midnight forward by twelve hours when needed.
    if (hasStartSuffix && !hasEndSuffix) {
      while (end <= start) end += 720;
    }
    if (end <= start) end += 1440;
    if (end - start > 180) return null;
    return { start, end };
  }

  function periodNumber(label) {
    const text = normalize(label).replace(/[إأآ]/g, "ا");
    const words = [["الأولى",1],["الاولى",1],["الأول",1],["الاول",1],["اولى",1],["اول",1],["الثانية",2],["الثاني",2],["ثانية",2],["ثاني",2],["الثالثة",3],["الثالث",3],["ثالثة",3],["ثالث",3],["الرابعة",4],["الرابع",4],["رابعة",4],["رابع",4],["الخامسة",5],["الخامس",5],["خامسة",5],["خامس",5],["السادسة",6],["السادس",6],["سادسة",6],["سادس",6],["السابعة",7],["السابع",7],["سابعة",7],["سابع",7]];
    const explicit = text.match(/^(?:الحصة|حصة|الفترة|درس)\s*(?:ال)?(اولى|اول|ثانية|ثاني|ثالثة|ثالث|رابعة|رابع|خامسة|خامس|سادسة|سادس|سابعة|سابع)(?:\s|$)/);
    if (explicit) {
      const found = words.find(([word]) => word.replace(/[إأآ]/g, "ا") === explicit[1]);
      if (found) return found[1];
    }
    for (const [word, number] of words) if (text.includes(word)) return number;
    const match = text.match(/(?:الحصة|الفترة|درس)\s*([1-7١-٧])(?:\D|$)/);
    return match ? Number(asciiDigits(match[1])) : null;
  }

  function mapHeaders(rawHeaders) {
    const headers = rawHeaders.map(header => ({
      ...header,
      label: normalize(header.label),
      n: periodNumber(header.label)
    })).filter(header => header.n !== null);
    if (headers.length !== 7) return [];
    headers.sort((a, b) => a.n - b.n);
    if (headers.some((header, index) => header.n !== index + 1)) return [];
    const seen = new Set();
    for (const header of headers) {
      if (!Number.isInteger(header.cellIndex) || seen.has(header.cellIndex)) return [];
      seen.add(header.cellIndex);
    }
    return headers;
  }

  function resolveCellPeriod(headers, cellIndex, explicitValue) {
    if (explicitValue !== null && explicitValue !== undefined && String(explicitValue).trim() !== "") {
      const raw = asciiDigits(explicitValue);
      if (!/^[1-7]$/.test(raw)) return null;
      return Number(raw);
    }
    const matches = headers.filter(header => {
      const span = Number(header.columnSpan) || 1;
      return cellIndex >= header.cellIndex && cellIndex < header.cellIndex + span;
    });
    return matches.length === 1 ? matches[0].n : null;
  }

  function validTeamsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && ["teams.microsoft.com", "teams.live.com"].includes(url.hostname) && url.pathname.length > 1;
    } catch (_) { return false; }
  }

  function selectPeriodLinks(items, period) {
    const seen = new Set();
    return items.filter(item => {
      if (item.period !== period || !validTeamsUrl(item.url)) return false;
      const key = `${item.teacher}\u0000${item.period}\u0000${item.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function selectPeriodItems(items, period) {
    const seen=new Set();
    return (items||[]).filter(item=>{
      if(item.period!==period||!item.teacher||!validTeamsUrl(item.url))return false;
      const key=`${item.teacher}\u0000${item.period}\u0000${item.url}`;
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
  }

  function nameAppears(name, text) {
    const tokens = value => normalize(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
      .filter(token => !["بن","ابن","ال"].includes(token));
    const target = tokens(name), haystack = new Set(tokens(text));
    return target.length >= 2 && haystack.has(target[0]) && haystack.has(target[target.length - 1]);
  }

  function classifyOrganizerMembership(organizerName, invitedText, inviteesReadable, fullyScanned=true) {
    if (!organizerName || !inviteesReadable) return { status:"unresolved", teacher:organizerName||"" };
    if (nameAppears(organizerName, invitedText)) return { status:"absent", teacher:organizerName };
    if (!fullyScanned) return { status:"unresolved", teacher:organizerName };
    return { status:"present", teacher:organizerName };
  }

  function summarizeAttendanceStatuses(records) {
    const statuses=(records||[]).map(item=>typeof item==="string"?item:(item?.scanStatus||item?.status));
    for(let i=statuses.length-1;i>=0;i--)if(statuses[i]==="present"||statuses[i]==="absent")return statuses[i];
    return "unresolved";
  }

  globalThis.MirsadScheduleCore = Object.freeze({ normalize, asciiDigits, parseTimeRange, makeManualPeriods, periodAtMinute, periodNumber, mapHeaders, resolveCellPeriod, validTeamsUrl, selectPeriodItems, selectPeriodLinks, classifyOrganizerMembership, summarizeAttendanceStatuses });
})();

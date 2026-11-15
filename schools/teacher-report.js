"use strict";

(function (_argument) {
  'use strict';

  const _value = _argument2 => String(_argument2 ?? "").replace(/[.:…]+/g, "").replace(/ {2,}/g, " ").trim(),
    _value2 = _argument3 => String(_argument3 ?? "").replace(/[&<>"']/g, _argument4 => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&apos;"
    })[_argument4]),
    _options = {
      "daily": "متابعة الحضور اليومية",
      "lessons": "غياب حصص",
      "partial": "تأخر / حضور جزئي",
      "late": "تأخر عن الحصص",
      "partial-absence": "غياب جزئي عن الحصص",
      "day": "غياب يوم كامل"
    };
  function _value3(_argument5, _argument6, _argument7 = new Date(), _argument8 = {}) {
    const _value4 = _argument6.cells(_argument5, {
        "now": _argument7
      }).map(_argument9 => {
        if (!_argument8.includeProvisional || _argument9.override || _argument9.reset || ["present", "absent", "partial", "partial-absence"].includes(_argument9.state)) return _argument9;
        const _value5 = _argument9.rounds.filter(_argument0 => !_argument0.pending && ["present", "absent"].includes(_argument0.status));
        if (!_value5.some(_argument1 => _argument1.status === "absent")) return _argument9;
        return {
          ..._argument9,
          "state": _value5.some(_argument10 => _argument10.status === "present") ? "partial" : "absent",
          "provisional": true
        };
      }),
      _items = [];
    for (const _value6 of _argument5?.["snapshot"]?.["teachers"] || []) {
      const _value7 = _value4.filter(_argument11 => _argument11.teacherId === _value6.id),
        _value8 = _value7.filter(_argument12 => _argument12.state === "absent"),
        _value9 = _value7.filter(_argument13 => _argument13.state === "partial"),
        _value0 = _value7.filter(_argument14 => _argument14.state === "partial-absence"),
        _value1 = _value7.length > 0 && _value7.every(_argument15 => _argument15.state === "absent" && _argument15.ended && !_argument15.provisional),
        _value10 = (_argument16, _argument17) => _items.push({
          "id": _value6.id,
          "name": _value6.name,
          "date": _argument5.snapshot.date,
          "type": _argument16,
          "lessons": _argument17,
          "absent": ["partial", "late", "partial-absence"].includes(_argument16) ? [] : _argument17,
          "fullDay": _argument16 === "day"
        });
      if (_value1) _value10("day", _value8);else {
        if (_value8.length) _value10("lessons", _value8);
        if (_value9.length) _value10("partial", _value9);
        if (_value0.length) _value10("partial-absence", _value0);
      }
    }
    return _items;
  }
  function _value11(_argument18, _argument19, _argument20 = new Date()) {
    const _value12 = new Map();
    for (const _value13 of _value3(_argument18, _argument19, _argument20, {
      "includeProvisional": true
    })) {
      let _value14 = _value12.get(_value13.id);
      !_value14 && (_value14 = {
        "id": _value13.id,
        "name": _value13.name,
        "date": _value13.date,
        "type": "daily",
        "reports": [],
        "lessons": []
      }, _value12.set(_value13.id, _value14)), _value14.reports.push(_value13), _value14.lessons.push(..._value13.lessons), _value14.provisional = _value14.lessons.some(_argument21 => _argument21.provisional);
    }
    return [..._value12.values()];
  }
  function _value15(_argument22) {
    const _value16 = new TextEncoder(),
      _items2 = [],
      _items3 = [];
    let _number = 0;
    const _value17 = (_argument23, _argument24, _argument25) => _argument23.setUint16(_argument24, _argument25, true),
      _value18 = (_argument26, _argument27, _argument28) => _argument26.setUint32(_argument27, _argument28 >>> 0, true);
    for (const [_value19, _value20] of Object.entries(_argument22)) {
      const _value21 = _value16.encode(_value19),
        _value22 = _value20 instanceof Uint8Array ? _value20 : _value16.encode(_value20);
      let _number2 = 4294967295;
      for (const _value23 of _value22) {
        _number2 ^= _value23;
        for (let _number3 = 0; _number3 < 8; _number3++) _number2 = _number2 >>> 1 ^ (_number2 & 1 ? 3988292384 : 0);
      }
      _number2 = (_number2 ^ 4294967295) >>> 0;
      const _value24 = new Uint8Array(30 + _value21.length),
        _value25 = new DataView(_value24.buffer);
      _value18(_value25, 0, 67324752), _value17(_value25, 4, 20), _value17(_value25, 6, 2048), _value18(_value25, 14, _number2), _value18(_value25, 18, _value22.length), _value18(_value25, 22, _value22.length), _value17(_value25, 26, _value21.length), _value24.set(_value21, 30), _items2.push(_value24, _value22);
      const _value26 = new Uint8Array(46 + _value21.length),
        _value27 = new DataView(_value26.buffer);
      _value18(_value27, 0, 33639248), _value17(_value27, 4, 20), _value17(_value27, 6, 20), _value17(_value27, 8, 2048), _value18(_value27, 16, _number2), _value18(_value27, 20, _value22.length), _value18(_value27, 24, _value22.length), _value17(_value27, 28, _value21.length), _value18(_value27, 42, _number), _value26.set(_value21, 46), _items3.push(_value26), _number += _value24.length + _value22.length;
    }
    const _value28 = _items3.reduce((_argument29, _argument30) => _argument29 + _argument30.length, 0),
      _value29 = new Uint8Array(22),
      _value30 = new DataView(_value29.buffer);
    _value18(_value30, 0, 101010256), _value17(_value30, 8, _items3.length), _value17(_value30, 10, _items3.length), _value18(_value30, 12, _value28), _value18(_value30, 16, _number);
    const _value31 = _number + _value28 + 22,
      _value32 = new Uint8Array(_value31);
    let _number4 = 0;
    for (const _value33 of [..._items2, ..._items3, _value29]) {
      _value32.set(_value33, _number4), _number4 += _value33.length;
    }
    return _value32;
  }
  function _value34(_argument31) {
    const _value35 = _argument31.lessons || _argument31.absent || [];
    if (!_value35.length) throw new Error("لا توجد حالات معتمدة لهذا النموذج");
    const _value36 = _argument31.type || (_argument31.fullDay ? "day" : "lessons"),
      _value37 = _options[_value36];
    if (!_value37) throw new Error("نوع النموذج غير صحيح");
    const _value38 = (_argument32, _argument33 = false, _argument34 = "right", _argument35 = {}) => ({
        "value": _value(_argument32),
        "bold": _argument33,
        "align": _argument34,
        ..._argument35
      }),
      _value39 = new Intl.DateTimeFormat("ar-SA", {
        "timeZone": "Asia/Riyadh",
        "weekday": "long"
      }).format(new Date(_argument31.date + "T12:00:00+03:00")),
      _value40 = _value36 === "daily" ? _argument31.reports : [_argument31];
    if (!_value40?.["length"] || _value40.some(_argument36 => _argument36.date !== _argument31.date || _argument36.id !== _argument31.id)) throw new Error("يجب أن تخص جميع الحالات المعلم واليوم نفسيهما");
    const _items4 = [_value38("طلب إفادة", true, "center"), _value38("اليوم: " + _value39 + "    التاريخ: " + _argument31.date, false, "left"), _value38("السلام عليكم ورحمة الله وبركاته،"), _value38("الأستاذ / " + _argument31.name, true)];
    if (_argument31.provisional) _items4.push(_value38("أُعد هذا الخطاب وفق حالات الرصد المتاحة حتى وقت إصداره"));
    for (const _value41 of _value40) {
      const _value42 = _value41.type || _value36,
        _value43 = _value41.lessons || _value41.absent || [];
      if (_value40.length > 1) _items4.push(_value38(_options[_value42], true, "center"));
      _items4.push(_value38(_value42 === "partial-absence" ? "لوحظ قلة تواجدكم في الحصة، نرجو الإفادة. وذلك بشأن الحصص الآتية:" : _value42 === "day" ? "لوحظ تغيبكم عن اليوم الدراسي الموضح أعلاه، نرجو الإفادة." : _value42 === "partial" || _value42 === "late" ? "لوحظ عدم التزامكم بزمن الحصة المستحق، نرجو الإفادة. وذلك بشأن الحصص الآتية:" : "لوحظ تغيبكم عن الحصص الآتية في اليوم الموضح أعلاه، نرجو الإفادة."));
      if (_value42 !== "day") {
        for (const _value44 of _value43) _items4.push(_value38("الحصة " + _value44.period + (_value44.subject ? " \u2014 " + _value44.subject : "") + (_value44.className ? " \u2014 الفصل: " + _value44.className : "")));
      }
    }
    return _items4.push(_value38("يرجى توضيح الأسباب المتعلقة بما ورد أعلاه، وإرفاق ما يؤيد الإفادة إن وجد."), _value38("مدير المتوسطة", true, "center", {
      "spaceBefore": _options2.lineHeight * 2,
      "spaceAfter": _options2.lineHeight,
      "keepNext": true
    }), _value38("", false, "center", {
      "spaceAfter": _options2.lineHeight,
      "directorSignature": true,
      "keepNext": true
    }), _value38(_argument.MirsadSchoolProfile?.["director"] || "", true, "center", {
      "spaceAfter": _options2.lineHeight
    }), _value38("إفادة المعلم", true, "center"), _value38(_value40.length > 1 ? "الإفادة عن الحالات الموضحة أعلاه: ........................................................" : _value40[0].type === "partial-absence" ? "سبب التغيب الجزئي: ................................................................................" : _value40[0].type === "partial" || _value40[0].type === "late" ? "سبب عدم الالتزام بزمن الحصة: ........................................................" : "سبب التغيب: ................................................................................"), _value38("................................................................................................"), _value38("................................................................................................"), _value38("المرفقات إن وجدت", false, "right", {
      "spaceAfter": _options2.lineHeight,
      "keepNext": true
    }), _value38("اسم المعلم " + _argument31.name, false, "right", {
      "spaceAfter": _options2.lineHeight,
      "keepNext": true
    }), _value38("التوقيع", false, "right", {
      "keepNext": true
    }), _value38("التاريخ")), _items4;
  }
  const _options2 = {
    "font": "IBM Plex Sans Arabic",
    "bodyFont": 11.5,
    "titleFont": 13,
    "lineHeight": 5.8,
    "paragraphGap": 1.8,
    "boldGap": 2.4,
    "margin": 15,
    "top": 52,
    "bottom": 18,
    "headerTop": 10,
    "footer": 7
  };
  let _value45;
  async function _value46() {
    if (!_value45) _value45 = fetch("assets/fonts/IBMPlexSansArabic-Regular.ttf").then(async _argument37 => {
      if (!_argument37.ok) throw new Error("تعذر تحميل خط الخطاب؛ أعد المحاولة");
      return new Uint8Array(await _argument37.arrayBuffer());
    })["catch"](_argument38 => {
      _value45 = null;
      throw _argument38;
    });
    return _value45;
  }
  const _value47 = _argument39 => Math.round(_argument39 * 1440 / 25.4);
  function _value48(_argument40, _argument41 = _options2.bodyFont, _argument42 = false) {
    return "<w:r><w:rPr><w:rtl/><w:rFonts w:ascii=\"" + _options2.font + "\" w:hAnsi=\"" + _options2.font + "\" w:cs=\"" + _options2.font + "\"/><w:sz w:val=\"" + _argument41 * 2 + "\"/><w:szCs w:val=\"" + _argument41 * 2 + "\"/>" + (_argument42 ? "<w:b/><w:bCs/>" : "") + "</w:rPr><w:t xml:space=\"preserve\">" + _value2(_argument40) + "</w:t></w:r>";
  }
  function _value49(_argument43, _argument44) {
    const _value50 = (_argument45, _argument46 = false) => "<w:p><w:pPr><w:bidi/>" + (_argument46 ? "<w:jc w:val=\"center\"/>" : "") + "<w:spacing w:after=\"0\" w:line=\"" + _value47(4.5) + "\" w:lineRule=\"exact\"/></w:pPr>" + _value48(_value(_argument45), 10) + "</w:p>",
      _value51 = (_argument47, _argument48) => "<w:tc><w:tcPr><w:tcW w:w=\"" + _value47(_argument48) + "\" w:type=\"dxa\"/><w:vAlign w:val=\"top\"/></w:tcPr>" + _argument47 + "</w:tc>",
      _text = "<w:p><w:pPr><w:jc w:val=\"center\"/><w:spacing w:after=\"0\"/></w:pPr><w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\"><wp:extent cx=\"1152000\" cy=\"900000\"/><wp:docPr id=\"1\" name=\"شعار وزارة التعليم\"/><a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><pic:pic><pic:nvPicPr><pic:cNvPr id=\"1\" name=\"شعار وزارة التعليم\"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed=\"rId1\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"1152000\" cy=\"900000\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>";
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><w:hdr xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w=\"" + _value47(180) + "\" w:type=\"dxa\"/><w:tblLayout w:type=\"fixed\"/><w:tblCellMar><w:top w:w=\"0\" w:type=\"dxa\"/><w:left w:w=\"0\" w:type=\"dxa\"/><w:bottom w:w=\"0\" w:type=\"dxa\"/><w:right w:w=\"0\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr><w:tblGrid>" + [64, 52, 64].map(_argument49 => "<w:gridCol w:w=\"" + _value47(_argument49) + "\"/>").join("") + "</w:tblGrid><w:tr>" + _value51(["المملكة العربية السعودية", "وزارة التعليم", globalThis.MirsadSchoolProfile?.["educationAdministration"] || "الإدارة العامة للتعليم", _argument43 || ""].map(_argument50 => _value50(_argument50)).join(""), 64) + _value51(_text, 52) + _value51(_value50("التاريخ " + _argument44) + _value50("الرقم"), 64) + "</w:tr></w:tbl><w:p><w:pPr><w:spacing w:after=\"0\" w:line=\"" + _value47(8) + "\" w:lineRule=\"exact\"/><w:pBdr><w:bottom w:val=\"single\" w:sz=\"2\" w:color=\"A5B6BE\"/></w:pBdr></w:pPr></w:p></w:hdr>";
  }
  function _value52() {
    return "<w:p><w:pPr><w:jc w:val=\"center\"/><w:spacing w:after=\"" + _value47(2) + "\"/></w:pPr><w:r><w:drawing><wp:inline xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\"><wp:extent cx=\"1728000\" cy=\"518400\"/><wp:docPr id=\"700\" name=\"توقيع مدير المدرسة\"/><a:graphic xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\"><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><pic:pic xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><pic:nvPicPr><pic:cNvPr id=\"700\" name=\"توقيع المدير\"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed=\"rIdMirsadDirectorSignature\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"1728000\" cy=\"518400\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>";
  }
  function _value53(_argument51, _argument52 = "", _argument53, _argument54 = _argument.MirsadDirectorSignature?.["get"]() || "") {
    if (!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(_argument54) || _argument54.length >= 1000000) _argument54 = "";
    const _value54 = ({
        value: _argument55,
        bold: _argument56,
        align: _argument57,
        spaceBefore = 0,
        spaceAfter: _argument58,
        keepNext = false,
        directorSignature = false
      }) => "<w:p><w:pPr>" + (_argument57 === "left" ? "<w:bidi w:val=\"0\"/>" : "<w:bidi/>") + (_argument57 === "center" ? "<w:jc w:val=\"center\"/>" : _argument57 === "left" ? "<w:jc w:val=\"left\"/>" : "") + (_argument56 || keepNext || _argument54 && directorSignature ? "<w:keepNext/>" : "") + "<w:spacing w:before=\"" + _value47(spaceBefore) + "\" w:after=\"" + _value47(_argument58 ?? (_argument56 ? _options2.boldGap : _options2.paragraphGap)) + "\" w:line=\"" + _value47(_options2.lineHeight) + "\" w:lineRule=\"exact\"/></w:pPr>" + _value48(_argument55, _argument56 ? _options2.titleFont : _options2.bodyFont, _argument56) + "</w:p>",
      _value55 = _value34(_argument51).flatMap(_argument59 => [_value54(_argument59), ...(_argument54 && _argument59.directorSignature ? [_value52()] : [])]),
      _value56 = typeof module !== "undefined" ? require("./teacher-report-template.js") : _argument.MirsadTeacherReportTemplate,
      _options3 = {};
    for (const [_value57, _value58] of Object.entries(_value56)) {
      if (typeof _value58 === "string") _options3[_value57] = _value58.replaceAll("{اسم_المدرسة}", _value2(_argument52 || "")).replaceAll("{تاريخ_المعاملة}", _value2(_argument51.date)).replaceAll("{رقم_المعاملة}", "").replaceAll("{الإدارة_العامة_للتعليم}", _value2(globalThis.MirsadSchoolProfile?.["educationAdministration"] || ""));else {
        const _value59 = atob(_value58.base64);
        _options3[_value57] = Uint8Array.from(_value59, _argument60 => _argument60.charCodeAt(0));
      }
    }
    for (const _value60 of Object.keys(_options3)) {
      if (_value60.startsWith("word/header") && _value60.endsWith(".xml")) _options3[_value60] = _options3[_value60].replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (_argument61, _argument62, _argument63, _argument64) => _argument62 + _value(_argument63) + _argument64);
    }
    _argument54 && (_options3["word/media/director-signature.png"] = Uint8Array.from(atob(_argument54.split(",")[1]), _argument65 => _argument65.charCodeAt(0)), _options3["word/_rels/document.xml.rels"] = _options3["word/_rels/document.xml.rels"].replace("</Relationships>", "<Relationship Id=\"rIdMirsadDirectorSignature\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"media/director-signature.png\"/></Relationships>"));
    _options3["word/header2.xml"] = _value49(_argument52, _argument51.date), _options3["word/footer2.xml"] = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><w:ftr xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:p><w:pPr><w:bidi/><w:jc w:val=\"center\"/></w:pPr>" + _value48("مرصاد", 9) + "</w:p></w:ftr>";
    if (_argument53) {
      const _value61 = new Uint8Array(_argument53),
        _value62 = "FFEEDDCCBBAA99887766554433221100".match(/../g).map(_argument66 => parseInt(_argument66, 16));
      for (let _number5 = 0; _number5 < 32; _number5++) _value61[_number5] ^= _value62[_number5 % 16];
      _options3["word/fonts/MirsadArabic.odttf"] = _value61, _options3["word/fontTable.xml"] = _options3["word/fontTable.xml"].replace("</w:fonts>", "<w:font w:name=\"" + _options2.font + "\"><w:family w:val=\"swiss\"/><w:embedRegular r:id=\"rIdMirsadFont\" w:fontKey=\"{00112233-4455-6677-8899-AABBCCDDEEFF}\"/></w:font></w:fonts>"), _options3["word/_rels/fontTable.xml.rels"] = "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rIdMirsadFont\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/font\" Target=\"fonts/MirsadArabic.odttf\"/></Relationships>", _options3["[Content_Types].xml"] = _options3["[Content_Types].xml"].replace("</Types>", "<Default Extension=\"odttf\" ContentType=\"application/vnd.openxmlformats-officedocument.obfuscatedFont\"/></Types>");
    }
    const _value63 = _options3["word/document.xml"],
      _value64 = "<w:sectPr><w:headerReference w:type=\"default\" r:id=\"rId8\"/><w:footerReference w:type=\"default\" r:id=\"rId10\"/><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"" + _value47(_options2.top) + "\" w:right=\"" + _value47(_options2.margin) + "\" w:bottom=\"" + _value47(_options2.bottom) + "\" w:left=\"" + _value47(_options2.margin) + "\" w:header=\"" + _value47(_options2.headerTop) + "\" w:footer=\"" + _value47(_options2.footer) + "\"/><w:bidi/></w:sectPr>";
    return _options3["word/settings.xml"] = _options3["word/settings.xml"].replace(/<w:evenAndOddHeaders[^>]*\/>/g, ""), _options3["word/document.xml"] = _value63.replace(/<w:body>[\s\S]*<\/w:body>/, "<w:body>" + _value55.join("") + _value64 + "</w:body>"), _value15(_options3);
  }
  async function _value65(_argument67, _argument68) {
    const _value66 = _value53(_argument67, _argument68, await _value46()),
      _value67 = URL.createObjectURL(new Blob([_value66], {
        "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      })),
      _value68 = document.createElement("a");
    _value68.href = _value67, _value68.download = "طلب إفادة - " + _options[_argument67.type || (_argument67.fullDay ? "day" : "lessons")] + " - " + _argument67.name.replace(/[\\/:*?"<>|]/g, "") + " - " + _argument67.date + ".docx", document.body.append(_value68), _value68.click(), _value68.remove(), setTimeout(() => URL.revokeObjectURL(_value67), 60000);
  }
  function _value69(_argument69, _argument70, _argument71 = new Date()) {
    const _value70 = (_argument69?.["snapshot"]?.["lessons"] || []).filter(_argument72 => !_argument70.isExcludedPeriod(_argument69.snapshot.date, _argument72.period, _argument69.snapshot));
    return _value70.length > 0 && _argument70.lessonEnded(_argument69, Math.max(..._value70.map(_argument73 => Number(_argument73.period))), _argument71);
  }
  const _options4 = {
    "ready": _value69,
    "zip": _value15,
    "daily": _value3,
    "teacherDaily": _value11,
    "documentBytes": _value53,
    "download": _value65,
    "paragraphs": _value34,
    "layout": _options2,
    "fontBytes": _value46,
    "typeLabel": _options
  };
  if (typeof module !== "undefined") module.exports = _options4;else _argument.MirsadTeacherReport = _options4;
})(globalThis);
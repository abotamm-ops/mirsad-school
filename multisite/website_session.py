"""Add a read-only website session derived from a verified recorder device."""

def transform(source):
    def replace(old, new):
        nonlocal source
        assert source.count(old) == 1, old
        source = source.replace(old, new)

    replace(
        "entry.until=now()+86400000;save(r);return {key,readOnly:entry.readOnly,school:publicSchool(s)}",
        """entry.recorderWebsite=input.purpose==='website';entry.until=now()+(entry.recorderWebsite?365:1)*86400000;
    if(entry.recorderWebsite)s.sessions=s.sessions.filter(x=>!x.recorderWebsite||!same(x.writerHash,entry.writerHash)||x===entry);
    save(r);return {key,readOnly:entry.readOnly,recorderWebsite:entry.recorderWebsite,school:publicSchool(s)}""",
    )
    replace(
        "v.school.simpleSetup&&!entry?.websitePin",
        "v.school.simpleSetup&&!entry?.websitePin&&!(entry?.recorderWebsite===true&&entry.readOnly===true&&entry.writerHash)",
    )
    replace("version:'2.9.53',unlimitedRecorderDevices", "version:'2.9.64',recorderWebsiteSession:true,unlimitedRecorderDevices")
    replace("// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.53", "// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.64")
    return source

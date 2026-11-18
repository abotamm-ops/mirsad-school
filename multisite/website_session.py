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


if __name__ == '__main__':
    import argparse
    from pathlib import Path

    parser = argparse.ArgumentParser(description='Upgrade the private Rased Schools service from 2.9.53 to 2.9.64.')
    parser.add_argument('source', type=Path, help='The private owner-2.9.53.gs file')
    parser.add_argument('output', type=Path, help='A new file for the upgraded Apps Script')
    args = parser.parse_args()
    try:
        upgraded = transform(args.source.read_text(encoding='utf-8'))
    except AssertionError:
        parser.error('The input does not match the expected 2.9.53 Schools service.')
    with args.output.open('x', encoding='utf-8') as output:
        output.write(upgraded)

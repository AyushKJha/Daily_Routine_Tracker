import unittest,tempfile,threading,json,urllib.request,urllib.error,http.cookiejar,sqlite3
from pathlib import Path
import server
from unittest.mock import patch, MagicMock
import os
class BackendTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory();server.DB_PATH=str(Path(cls.tmp.name)/'test.db');server.init_db()
  cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);threading.Thread(target=cls.http.serve_forever,daemon=True).start();cls.base='http://127.0.0.1:'+str(cls.http.server_port)
 @classmethod
 def tearDownClass(cls):cls.http.shutdown();cls.http.server_close();cls.tmp.cleanup()
 def client(self):return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def request(self,c,path,method='GET',data=None,headers=None):
  req=urllib.request.Request(self.base+path,data=None if data is None else json.dumps(data).encode(),method=method,headers={'Content-Type':'application/json','X-Requested-With':'Daily',**(headers or {})})
  try:
   with c.open(req) as r:return r.status,json.load(r),r.headers
  except urllib.error.HTTPError as e:return e.code,json.load(e),e.headers
 def test_full_account_and_save_lifecycle(self):
  c=self.client();status,data,h=self.request(c,'/api/auth/register','POST',{'username':'tester','email':'test@example.test','password':' correct horse battery '});self.assertEqual(status,201);self.assertIn('HttpOnly',h['Set-Cookie']);self.assertNotIn('token',data)
  self.assertEqual(self.request(c,'/api/auth/me')[0],200)
  _,day,_=self.request(c,'/api/habits/today');day['habits']={'exercise':True};day['score']=100
  for _ in range(5):
   status,result,_=self.request(c,'/api/habits/today','POST',day);self.assertEqual(status,200);self.assertEqual(result['score'],20);day['revision']=result['revision']
  stale={**day,'revision':None};self.assertEqual(self.request(c,'/api/habits/today','POST',stale)[0],409)
  bad={**day,'habits':{'exercise':'true'}};self.assertEqual(self.request(c,'/api/habits/today','POST',bad)[0],400)
  self.assertEqual(self.request(c,'/api/habits/today','POST',day,{'Origin':'https://evil.example'})[0],403)
  other=self.client();self.assertEqual(self.request(other,'/api/habits/history')[0],401)
  self.request(other,'/api/auth/register','POST',{'username':'other','email':'other@example.test','password':'test password 123'})
  self.assertEqual(self.request(other,'/api/habits/history')[1],[])
  self.assertEqual(len(self.request(c,'/api/export')[1]['days']),1)
  prefs=self.request(c,'/api/preferences')[1];prefs[0]['label']='My movement';self.assertEqual(self.request(c,'/api/preferences','PUT',{'habits':prefs})[0],200);self.assertEqual(self.request(c,'/api/preferences')[1][0]['label'],'My movement')
  self.assertEqual(self.request(c,'/api/coach')[0],200)
  self.assertEqual(self.request(c,'/api/auth/logout','POST',{})[0],200);self.assertEqual(self.request(c,'/api/auth/me')[0],401)
  self.assertEqual(self.request(c,'/api/auth/login','POST',{'identifier':'tester','password':' correct horse battery '})[0],200)
  self.assertEqual(self.request(c,'/api/habits/today')[1]['score'],20)
 def test_chat_contract_and_missing_key(self):
  c=self.client();self.request(c,'/api/auth/register','POST',{'username':'chatuser','email':'chat@example.test','password':'test password 123'})
  with patch.dict(os.environ,{'APIFY_API_TOKEN':'','APIFY_CHAT_ACTOR':''}):
   self.assertEqual(self.request(c,'/api/chat','POST',{'message':'How can I build a study habit?','consent':True})[0],503)
  with patch.dict(os.environ,{'APIFY_API_TOKEN':'test-not-real','APIFY_CHAT_ACTOR':'zerobreak/chatgpt-prompt-runner'}):
   self.assertEqual(self.request(c,'/api/chat','POST',{'message':'Hello'})[0],400)
   response=MagicMock();response.__enter__.return_value.read.return_value=json.dumps([{'reply':'Start with a small study block.','error':None}]).encode()
   with patch('server.urllib.request.urlopen',return_value=response) as mock:
    status,result,_=self.request(c,'/api/chat','POST',{'message':'Help me study','history':[],'consent':True})
    self.assertEqual(status,200);self.assertIn('study',result['reply']);request=mock.call_args.args[0]
    self.assertNotIn('test-not-real',request.full_url);self.assertIn('never diagnose',json.loads(request.data)['prompts'][0]);self.assertNotIn('chat@example.test',request.data.decode())
 def test_invalid_input(self):
  c=self.client();self.assertEqual(self.request(c,'/api/auth/register','POST',{'username':[]})[0],400)
  self.assertEqual(self.request(c,'/api/auth/register','POST',{'username':'bad','email':'noemail','password':'long password'})[0],400)
 def test_legacy_database_compatibility(self):
  c=self.client()
  with server.get_db() as db:db.execute('INSERT INTO users VALUES (?,?,?,?,?)',('legacy','legacy','legacy@example.test',server.hash_password('old123'),server.today_str()))
  self.assertEqual(self.request(c,'/api/auth/login','POST',{'identifier':'legacy','password':'old123'})[0],200)
if __name__=='__main__':unittest.main()

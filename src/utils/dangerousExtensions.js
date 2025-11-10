export const dangerousExtensions = [
  // Executable and System Files
  "exe", "bat", "cmd", "com", "msi", "apk", "sh", "bash", "bin", "jar", "ps1", "wsf", "vbs", 
  "vb", "scr", "reg", "dll", "pl", "py", "cgi", "rb", "cshtml", "ajax", "json", "vbe", "jscript",

  // Web-related dangerous files
  "html", "htm", "xhtml", "xsl", "xml", "tpl", "cfm", "erb", "asp", "aspx", "phps", 
  "phtml", "jsp", "tpl", "cfc", "htaccess", "htpasswd", "inc", "svn", "git", "bak", "db", "sql", 
  "sh", "bash", "yml", "yaml", "conf", "ini", "javascript", "ejs", "vue", "jsx", "html5", "scss", 
  "ts", "jsm", "xaml", "vbscript", "es", "css",

  // Documents and formats with macro risks or scripting capabilities
  "docm", "xlsm", "pptm", "rtf", "odm", "odc", "odf", "psd", "ai", "eps", "tex", "md", "rst", 
  "log", "swf", "fla", "xlsb", "docb", "xps", "potx", "potm", "dotx", "dotm", "pub", "pages", 
  "key", "numbers", "wpd", "keynote", "oxps", "msg", "mht", "mhtml", "chm", "epub", "mobi",

  // Files used for exploits or attacks
  "dat", "bak", "temp", "swp", "vmdk", "dmp", "dump", "reg", "env", "tmp", "bin", "b64", "hex", 
  "base64", "encrypted", "crypto", "enc", "ps", "sha1", "sha256", "gz", "7z", "tar", 
  "tar.gz", "tar.bz2", "xz", "iso", "dmg", "tgz", "lzh", "cab", "crx", "xpi", "img", "apk", "ipa", 
  "hqx", "uefi", "zst", "tbz", "lz", "vhd", "rpm", "deb", "pkg",

  // Malicious file types and scripting languages
  "locky", "crypt", "cryptolocker", "cerber", "tesla", "conti", "wannacry", "files", "ransom",
  "gzip", "mp3", "mp4", "hta", "java", "obj", "osx", "dylib", "axd", "axd", "debug", "command", 
  "csh", "zsh", "ksh", "tcsh", "fish", "bash", "lua", "io", "pogo", "tk", "cpp", "h", "pyc", 
  "class", "pm", "cpl", "swt", "shtml", "dat", "gpx", "asc", "keygen", "shs",

  // System-level files
  "sys", "drv", "config", "dbg", "cer", "crl", "pem", "csr", "key", "pfx", "p12", "crt", "csm", 
  "pdb", "avx", "vmx", "pvm", "ovf", "ova", "mnt", "ovf", "vhd", "bin", "htaccess", "vbe", "pl",
  "dll", "scpt", "nsf", "scr", "clj", "nsh", "cmd", "perl", "rst", "json", "scss", "xml", "md"
];

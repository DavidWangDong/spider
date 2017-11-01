const urlSolve = require('url')
const cheerio = require('cheerio')
const sa = require('superagent')
const request= require('superagent-charset')(sa);
const fs = require('fs')
const defConfig = {
    flags: 'a+',
    encoding: 'utf8',
    fd: null,
    mode: 0o777,
    autoClose: true
  }
class Spider {

    constructor (startUrl) {
        this.startUrl = startUrl;
        this.linkQueue = [];
        this.linkQueue.push(this.startUrl);
        this.actionList = [];
        this.hisToryList=[];
        this.publicPath='http://www.51shucheng.net/'
        this.currUrl='';
        this.ws=null;
        this.bookName='国士无双';
        this.regList = [
            {reg:/(\<\/p\>)/g,replace:'\n\r'},
            {reg:/(\<p\>)/g,replace:''},
            {reg:/(\<br\/*?\>)/g,replace:'\n\r'}
        ]
        console.log('初始化成功');
        this.startTime = new Date().getTime();
        this.endTime = '';
        this.start();
    }

    start (){
        console.log('检查是否存在历史文件');
        if (fs.existsSync('./download/'+this.bookName+'.txt')) {
            console.log('存在历史文件,并且删除成功!');
            fs.unlinkSync('./download/'+this.bookName+'.txt');
        }
        this.ws= fs.createWriteStream('./download/'+this.bookName+'.txt',defConfig);
        console.log('开始爬取....');
        this.queenAction();
        this.spide();
    }

    queenAction () {
        console.log('组件工厂队列....');
        var contents={};
        var count=1;
        this.actionList.push(function (content,next){
            // 获取网页内容
            const url = this.linkQueue.shift();
            if (this.hisToryList.indexOf(url)>-1){
                next&&next();
                return;
            }
            console.log('正在获取网页....'+url);
            this.currUrl=url;

            request.get(url)
               .charset('gb2312')
               .end((err,sres)=>{
                  if (err!==null){
                    //   console.log(err);
                      return;
                  }
                  content.$ = cheerio.load(sres.text,{decodeEntities: false})('body');
                  next&&next();
              })
        })
        this.actionList.push(function (content,next){
            // 根据reg获取有效连接
            if (!!!content.$){
                next&&next();
                return;
            }
            console.log('正在解析所有有效连接....')
            let avaliableReg = /44\d*.htm[l]*$/
            let links = content.$.find('a');
            
            links.each((index,a)=>{
                let href = cheerio(a).attr('href');
                if (typeof href==='string'&&avaliableReg.test(href)){
                    let real = urlSolve.resolve(this.currUrl,href);
                    this.hisToryList.indexOf(real)<=-1&&this.linkQueue.push(real);
                }
            })
            console.log('解析连接结束.....');
            next&&next();
        })
        this.actionList.push(function (content,next){
            if (!!!content.$){
                next&&next();
                return;
            }
            // 获取文章的标题和内容
            console.log('正在获取网页标题和内容....')
            let titleSel='.bookname h1';
            let contentSel='#content';
            let title = content.$.find(titleSel)
            let article = content.$.find(contentSel)
            if (title.length>0&&article.length>0){
                content.title=title.html();
                content.article=article.html();
            }
            next&&next();
        })
        this.actionList.push(function (content,next){
            if (!!!content.$){
                next&&next();
                return;
            }
            // 该连接结束放入历史队列
            this.hisToryList.push(this.currUrl);
            content.$=null;
            // 写入流
          
            if (content.title!==undefined&&content.article!==undefined){
                console.log('正在写入文件....');
                console.log(this.linkQueue.length);
                this.ws.write('\n\r章节名称:'+content.title+'\n\r\n\r'+this.regReplace(content.article));
                this.ws.once('drain',()=>{
                    console.log('写入完毕');
                })
            }
            next&&next();
        })

        for (let i=this.actionList.length-1;i>=0;i--){
            if (i==this.actionList.length-1){
                this.actionList[i] = this.actionList[i].bind(this,contents,this.spide.bind(this));
                continue
            }
            this.actionList[i] = this.actionList[i].bind(this,contents,this.actionList[i+1]);
        }
    }

    
    regReplace (str) {
        this.regList.forEach((rule)=>{
            str=str.replace(rule.reg,rule.replace);
        })
        return str;
    }


    spide () {
        if (this.linkQueue.length<=0){
            console.log('所有网页爬取完毕....');
            this.endTime = new Date().getTime();
            this.colcuUseTime();
            return;
        }
        this.actionList[0]();
    }

    colcuUseTime () {
        let disTime = this.endTime-this.startTime;
        let h = Math.floor(disTime/(1000*60*60));
        let m = Math.floor((disTime - h*(1000*60*60))/(1000*60))
        let s = Math.floor((disTime - h*(1000*60*60)-m*(1000*60))/1000);
        console.log('爬取结束，总耗时:'+m+'时'+h+'分'+s+'秒');
    }

}

const spide = new Spider('http://www.37zw.net/0/870/')
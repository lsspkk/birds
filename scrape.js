const cheerio=require('cheerio')
const request = require("request");
const fs = require('fs')

/**
 * Scrapetusta pala kerrallaan
 * 
 * lintujen-äänet.net sivuston varmenne on vanhentunut
 */
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

// lataa ensin tama kategoriat-tiedosto
function getCategories() {
 request.get('https://www.xn--lintujen-net-ocba.net/kategoriat/', function(e, r, body){
    console.log(body)
    });
}

// sit kayta tata lataamaan linkit lintukategorioihin
function getNamesFile(categoryFilename) {
    return new Promise(function(resolve, reject) {
    fs.readFile(categoryFilename, (err,data) => {
        if (err) reject(err)
        

        const $ = cheerio.load(data)
        const categorylist = $('#categorylist')
        var result = []
        let a = categorylist.find("a").each((i,e) => 
            result.push(
            {
                url: $(e).attr('href'),
                name:$(e).text()
            })
        );
        resolve(result)
    })
})
}

// talla lataa ja parsii yhden linnun kategorian alta linnun nimen, linkin linnun tietoihin ja polun linnun kuvaan
async function getBirdsWeb(category) {
    return new Promise(function(resolve, reject) {
        request.get('https://www.xn--lintujen-net-ocba.net/'+category, function(e, r, data){
        if( e) {
            reject(e)
            return;
        } 
        let result = []
        const $ = cheerio.load(data)
        const birds = $('.cover-inner-align')
        birds.each((i,e)=> {
            result.push({
                image: $(e).find('img').attr('src'),
                url: $(e).find('a').attr('href'),
                name: $(e).find('img').attr('alt')
            })
            resolve(result)
        })
    })
})
}
// why not work?
// var promises = []
// var namesCall = getNamesFile(categoryFilename)
// promises.push(namesCall)
// namesCall.then(data => {
//     data.forEach(e => {
//         console.log(e)
//         var birdsCall = getBirdsWeb(e.url)
//         promises.push(birdsCall)
//         birdsCall.then(birds => {
//             e.birds = birds
//         })
//     })
//     Promise.all(promises).then(ok => {console.log(JSON.stringify(ok, null, 2))})
// })

// getNamesFile(categoryFilename).then(async function(data) {
//     await data.forEach(async function(e) {
//         var birds = await getBirdsWeb(e.url)
//         e.birds = birds
//         console.log(e)
//     })
//     console.log(JSON.stringify(data, null, 2))
// })

// toimmii
// talla lataa jokaisen kategorian linnut yhteen jsoniin, ohjaa siis tan output tiedostoon
function getAllBirdsInCategories(categoryFilename) {
    getNamesFile(categoryFilename).then(data => {
        var promises = []
        data.forEach(e => {
            promises.push(getBirdsWeb(e.url).then(birds => {e.birds = birds; return e}))
        })
        Promise.all(promises).then(result => {
            console.log(JSON.stringify(data, null, 2))
        })
    })
}

// talla tekee out.json:sta komennot, joilla voi curlia kayttaen ladata kuvat
function makeImageCurlCommands(jsonFile) {
    const prefix = "curl -H 'accept: image/jpeg' -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36' -O "
    fs.readFile(jsonFile, (err,data) => {
        if (err) reject(err)
        var all = JSON.parse(data)
        all.forEach(e => {
            e.birds.forEach(b => console.log(prefix + 'https://www.xn--lintujen-net-ocba.net/'+b.image))
        })
    })
}

// parsii linnun sivulta audion url:n
function getAudioUrl(url) {
    return new Promise((resolve, reject) => {
        request('https://www.xn--lintujen-net-ocba.net/'+url, (err,response,data) => {
        if (err) reject(err)
        var $ = cheerio.load(data)
        var audio = $('source').attr('src')
        resolve(audio)
        })
    })
}

// getAudioUrl('sinirinta/').then(k => console.log(k))

// lataa kaikkien lintujen audio-url:t, mutta jostain syysta ei toimi kerralla, vaan pitaa kayttaa syotteena
// jsonia, joka on talla saatu, muutaman kerran jalkeen kaikki audio urlt: on siina

function getAudioUrls(jsonFile) {
    fs.readFile(jsonFile, (err,data) => {
        if (err) reject(err)
        var all = JSON.parse(data)
        var promises = []
        all.forEach(e => {
            e.birds.forEach(b => {
                if( b.audio )
                    return
                promises.push(getAudioUrl(b.url).then(a => {b.audio = a;return a }))
            })
        })
        Promise.all(promises).then(result => { console.log(JSON.stringify(all, null, 2))})
    })
}

// kun jsonissa on kaikkien äänitiedostojen polut
// tämän ajamalla saa curl komennot, joilla äänet saa ladattua
function makeAudioCurlCommands(jsonFile) {
    fs.readFile(jsonFile, (err,data) => {
        if (err) reject(err)
        var all = JSON.parse(data)
        const prefix = "curl -H 'accept: audio/*' -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36'"
        all.forEach(e => {
            e.birds.forEach(b => console.log( prefix + ' -o '+b.url.split('/')[0] +'.mp3 https://www.xn--lintujen-net-ocba.net/'+b.audio))
        })
    })
}
function clean(jsonFile) {
    fs.readFile(jsonFile, (err,data) => {
        if (err) reject(err)
        var all = JSON.parse(data)
        var birds = []
        all.forEach(k => {
            k.birds.forEach(b => {
                b.category = k.name.split(' (')[0]
                b.audio = 'audio/'+b.url.split('/')[0]+'.mp3'
                delete b.url
                birds.push(b)
            })
        })
        console.log(JSON.stringify(birds, null, 2))
    })
}

var args = process.argv.slice(2)
var allowed = [ 'kategoriat', 'linnut', 'kuvalatauskomennot', 'aanet', 'aanilatauskomennot', 'siisti']
if( args.length < 1 || !allowed.includes(args[0]) ) {
    console.log("esimerkki käyttämisestä\n")
    console.log("node scape.js kategoriat > kategoriat.html ... lataa lintukategoriat")
    console.log("node scape.js linnut kategoriat.html > birds.json ... lataa/parsii lintuja kategoria-tiedostosta")
    console.log("node scape.js kuvalatauskomennot birds.json > curlaakuvat.sh ... printtaa curl komentoja")
    console.log("node scape.js aanet birds.json > birds2.json ... lataa/parsii äänen lataus linkkejä")
    console.log("node scape.js aanet birds2.json > birds3.json ... lataa/parsii äänen lataus linkkejä")
    console.log("node scape.js aanet birds3.json > birds4.json ... lataa/parsii äänen lataus linkkejä, eiköhän nyt ole joka linnulla jo")
    console.log("node scape.js aanilatauskomennot birds4.json > curlaaaanet.sh ... printtaa curl komentoja")
    console.log("node scape.js siisti birds4.json > linnut.json ... vaihtaa json-tiedoissa linnun aanitiedoston omituisista numeroista lintujen nimiksi ja muuttaa json rakenteen asettaen linnuille kategoriat attribuutiksi")
    console.log("\nSitten vain lisäät .sh-tiedostojen alkuun esim #/usr/bin/bash, ja lataat lintujen kuvat sekä audiot")
}
else if( args[0] == 'kategoriat' ) {
    getCategories()
}
else if( args[0] == 'linnut' ) {
    getAllBirdsInCategories(args[1])
}
else if( args[0] == 'kuvalatauskomennot') {
    makeImageCurlCommands(args[1])
}else if( args[0] == 'aanet') {
    getAudioUrls(args[1])
}else if( args[0] == 'aanilatauskomennot') {
    makeAudioCurlCommands(args[1])
}else if( args[0] == 'siisti') {
    clean(args[1])
}
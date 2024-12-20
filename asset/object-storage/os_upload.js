(function () {

    const vendorType = {
        type:'',
        combinePolicyGetUrl:function f(policyGetUrl, filename,file,hashId){
            const queryString = policyGetUrl.split('?')[1];
            const otherString = 'title='+encodeURIComponent(filename)+'&hash_id='+hashId+'&file_type='+file.type;

            if (!queryString) {
                return policyGetUrl+'?'+otherString;
            }

            return policyGetUrl+'&'+otherString;
        },
        combineUploadParam:function f(up,res,file,filename){
            return {
                'url': res.url,
                'multipart_params': res.params,
            }
        }
    }

    const aliyunOssVendorType = {
        type:'aliyun_oss',
        combineUploadParam:function f(up,res,file, filename){
            let new_multipart_params = {
                'key' : this.calculate_object_name(filename, res['dir']),
                'policy': res['policy'],
                'OSSAccessKeyId': res['accessid'],
                'success_action_status' : '200', //让服务端返回200,不然，默认会返回204
                'callback' : res['callback'],
                'signature': res['signature'],
            };

            const var_obj = JSON.parse(res['callback_var']);
            for(const key in var_obj){
                new_multipart_params[key] = var_obj[key];
            }
            if(res['oss_meta']){
                const meta_obj = JSON.parse(res['oss_meta']);
                for(const meta in meta_obj){
                    new_multipart_params[meta] = meta_obj[meta];
                }
            }

            return {
                'url': res['host'],
                'multipart_params': new_multipart_params,
            };
        },
        calculate_object_name:function f(filename, key){
            let suffix = this.get_suffix(filename);
            return key + suffix;
        },
        get_suffix:function f(filename) {
            let pos = filename.lastIndexOf('.');
            let suffix = '';
            if (pos !== -1) {
                suffix = filename.substring(pos);
            }
            return suffix;
        }
    }

    const volcengineTosVendorType = {
        type:'volcengine_tos',
        combineUploadParam:function f(up,res,file, filename){
            // return this.handlePutParamDemo(up,res,file, filename);

            return {
                'url': res.url,
                'multipart_params': res.params,
            };
        },
        handlePutParamDemo:function f(up,res,file, filename){

            const headers = Object.assign(up.setOption('headers') || {}, res.headers);
            headers['Content-Type']=file.type;

            return {
                'multipart': false,
                'send_file_name': false,
                'send_chunk_number': false,
                'http_method': 'PUT',
                'headers': headers,
                'url': res.url,
                'multipart_params': {},
            };
        }
    }

    const tengxunCosVendorType = {
        type:'tengxun_cos',
        combineUploadParam:function f(up,res,file, filename){
            res.params = res.params || {};
            res.params['Content-Type']=file.type;

            return {
                'url': res.url,
                'multipart_params': res.params,
            };
        },
    }

    function genVendorType(type){
        let vendorTypeObj = {};
        switch (type){
            case 'aliyun_oss':
                vendorTypeObj =  Object.assign({},vendorType, aliyunOssVendorType)
                break;
            case 'volcengine_tos':
                vendorTypeObj =  Object.assign({},vendorType, volcengineTosVendorType)
                break;
            case 'tengxun_cos':
                vendorTypeObj =  Object.assign({},vendorType, tengxunCosVendorType)
                break;
            default:
                alert("不存在此供应商，请检查配置项");
                break;
        }

        return vendorTypeObj;
    }

    function send_request(url, method = 'GET', formData = null){
        let xmlhttp = null;
        if (window.XMLHttpRequest)
        {
            xmlhttp=new XMLHttpRequest();
        }
        else if (window.ActiveXObject)
        {
            xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
        }

        if (xmlhttp!=null)
        {
            xmlhttp.open( method, url, false );
            xmlhttp.send( formData );
            return xmlhttp.responseText
        }
        else
        {
            alert("Your browser does not support XMLHTTP.");
        }
    }

    const getFileType = {
        fileToArrayBuffer:function(file, callback){
            const reader = new FileReader()
            reader.onload = function(evt){
                if(typeof callback === 'function') {
                    return callback(evt.target.result)
                }
            }
            reader.readAsArrayBuffer(file);
        },
        getFileTypeViaHeader:function f(e) {
            const bufferInt = new Uint8Array(e);

            const arr = bufferInt.slice(0, 4);  // 通用格式图片
            const headerArr = bufferInt.slice(0, 16);  // heic格式图片
            let header = '';
            let allHeader = '';
            let realMimeType;

            for (let i = 0; i < arr.length; i++) {
                header += arr[i].toString(16); // 转成16进制的buffer
            }

            for (let i = 0; i < headerArr.length; i++) {
                allHeader += headerArr[i].toString(16);
            }
            // magic numbers: http://www.garykessler.net/library/file_sigs.html
            // console.log(header.indexOf('000'),allHeader.lastIndexOf('000'))
            switch (header) {
                case '89504e47':
                    realMimeType = 'image/png';
                    break;
                case '47494638':
                    realMimeType = 'image/gif';
                    break;
                case 'ffd8ffDB':
                case 'ffd8ffe0':
                case 'ffd8ffe1':
                case 'ffd8ffe2':
                case 'ffd8ffe3':
                case 'ffd8ffe8':
                    realMimeType = 'image/jpeg';
                    break;
                case '00020':  // heic开头前4位可能是00020也可能是00018，其实这里应该是判断头尾000的，可以自己改下
                case '00018':
                case '00024':
                case '0001c':
                    (allHeader.lastIndexOf('000') === 22) ? (realMimeType = 'image/heic') : (realMimeType = 'unknown');
                    break;
                default:
                    realMimeType = 'unknown';
                    break;
            }
            return realMimeType;
        },
        start:function(file, cb){
            const thisObj = this;
            thisObj.fileToArrayBuffer(file?.getNative() || file,function (res) {
                const type = thisObj.getFileTypeViaHeader(res);
                cb(type);
            });
        }
    }

    const osHooks = {
        hooks: {},

        // 注册钩子
        on(event, callback) {
            if (!this.hooks[event]) {
                this.hooks[event] = [];
            }
            this.hooks[event].push(callback);
        },

        // 触发钩子
        trigger(event, ...args) {
            if (this.hooks[event]) {
                this.hooks[event].forEach(callback => {
                    callback(...args);
                });
            }
        },

        // 移除钩子
        off(event, callback) {
            if (this.hooks[event]) {
                this.hooks[event] = this.hooks[event].filter(cb => cb !== callback);
            }
        }
    };

    osHooks.on('policyGet', function(vendorType, policyGetUrl, fileName, file, hashId, params){
        const vendorTypeObj = genVendorType(vendorType);
        let resBody = send_request(vendorTypeObj.combinePolicyGetUrl(policyGetUrl, fileName, file,hashId));
        params.policyRes = eval("(" + resBody + ")");

    });

    osHooks.on('genOsParam', function(vendorType, policyGetUrl, fileName, file, hashId = '', params,
                                      policyRes = '', policyReqObj = {method: 'GET', formData: null}) {
        const vendorTypeObj = genVendorType(vendorType);

        if (typeof policyRes === undefined || policyRes === ''){
            let resBody;
            if (file.type === ''){
                getFileType.start(file, function f(type){
                    file.type = type;
                    resBody = send_request(vendorTypeObj.combinePolicyGetUrl(policyGetUrl, fileName, file, hashId),
                        policyReqObj.method, policyReqObj.formData);
                })
            }else{
                resBody = send_request(vendorTypeObj.combinePolicyGetUrl(policyGetUrl, fileName, file, hashId),
                    policyReqObj.method, policyReqObj.formData);
            }

            policyRes = eval("(" + resBody + ")");
            if (policyRes.hasOwnProperty('list')){
                policyRes = policyRes.list[0];
            }
        }

        params.osParams = vendorTypeObj.combineUploadParam({}, policyRes, file, fileName)
    });

    window.osHooks = osHooks;

})()